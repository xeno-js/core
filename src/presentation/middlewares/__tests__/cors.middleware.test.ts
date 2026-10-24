import type { IContextAccessor, RequestContext, RoutePolicy, XenoRequest } from '@xeno-js/shared'
import type { ResponseDto } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CORSMiddleware } from '../cors.middleware'

vi.mock('@xeno-js/shared', () => ({
  Guards: {
    isDefined: (value: unknown) => value !== undefined && value !== null,
  },
}))

function makeMiddleware(
  options: {
    contextData?: Partial<RequestContext>
    policy?: RoutePolicy
    withCredentials?: 'true' | 'false'
  } = {},
) {
  const getContext = vi.fn().mockReturnValue(options.contextData)
  const requestContext = { getContext } as unknown as IContextAccessor<RequestContext>
  const checkRoutePolicy = vi.fn().mockReturnValue(options.policy ?? {})
  const getRouteMatcher = vi.fn(() => ({ checkRoutePolicy }))
  const middleware = new CORSMiddleware(
    requestContext,
    getRouteMatcher,
    options.withCredentials ?? 'false',
  )

  return { middleware, getContext, getRouteMatcher, checkRoutePolicy }
}

function makeRequest(path = '/api/test', method = 'GET'): XenoRequest {
  return { path, method } as unknown as XenoRequest
}

function makeResponse(headers?: ResponseDto['headers']): ResponseDto<{ ok: true }> {
  return {
    status: 200,
    ok: true,
    data: { success: true, data: { ok: true }, meta: {} },
    headers,
  } as unknown as ResponseDto<{ ok: true }>
}

describe('CORSMiddleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the original response when no origin or wildcard is configured', async () => {
    const { middleware, getContext, getRouteMatcher, checkRoutePolicy } = makeMiddleware()
    const response = makeResponse()
    const next = vi.fn().mockResolvedValue(response)

    const result = await middleware.execute(makeRequest('/api/no-origin', 'POST'), next)

    expect(result).toBe(response)
    expect(result.headers).toBeUndefined()
    expect(getContext).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledOnce()
    expect(getRouteMatcher).toHaveBeenCalledOnce()
    expect(checkRoutePolicy).toHaveBeenCalledWith('/api/no-origin', 'POST')
  })

  it('preserves existing headers when there is no origin and the policy does not allow a wildcard', async () => {
    const { middleware } = makeMiddleware({
      contextData: { network: { origin: undefined } } as Partial<RequestContext>,
      policy: { allowOrigins: ['https://app.example.com'] },
    })
    const response = makeResponse({ 'Content-Type': ['application/json'] })
    const originalHeaders = response.headers
    const next = vi.fn().mockResolvedValue(response)

    const result = await middleware.execute(makeRequest(), next)

    expect(result).toBe(response)
    expect(result.headers).toBe(originalHeaders)
    expect(result.headers).toEqual({ 'Content-Type': ['application/json'] })
  })

  it('adds CORS headers using the request origin and configured credentials fallback', async () => {
    const { middleware } = makeMiddleware({
      contextData: {
        network: { origin: 'https://app.example.com' },
      } as Partial<RequestContext>,
      withCredentials: 'true',
    })
    const response = makeResponse({ 'Content-Type': ['application/json'] })
    const next = vi.fn().mockResolvedValue(response)

    const result = await middleware.execute(makeRequest(), next)

    expect(result).toBe(response)
    expect(result.headers).toEqual({
      'Content-Type': ['application/json'],
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    })
  })

  it('uses the route credentials setting when explicitly enabled', async () => {
    const { middleware } = makeMiddleware({
      contextData: {
        network: { origin: 'https://app.example.com' },
      } as Partial<RequestContext>,
      policy: { withCredentials: true },
    })
    const response = makeResponse()
    const next = vi.fn().mockResolvedValue(response)

    await middleware.execute(makeRequest(), next)

    expect(response.headers).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    })
  })

  it('uses wildcard origin when wildcard access is allowed without credentials', async () => {
    const { middleware } = makeMiddleware({ policy: { allowOrigins: ['*'] } })
    const response = makeResponse()
    const next = vi.fn().mockResolvedValue(response)

    await middleware.execute(makeRequest(), next)

    expect(response.headers).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'false',
      'Vary': 'Origin',
    })
  })

  it('uses the route credentials setting when explicitly disabled', async () => {
    const { middleware } = makeMiddleware({
      contextData: {
        network: { origin: 'https://app.example.com' },
      } as Partial<RequestContext>,
      policy: { withCredentials: false, allowOrigins: ['*'] },
      withCredentials: 'true',
    })
    const response = makeResponse()
    const next = vi.fn().mockResolvedValue(response)

    await middleware.execute(makeRequest(), next)

    expect(response.headers).toMatchObject({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'false',
      'Vary': 'Origin',
    })
  })

  it('does not use wildcard origin when credentials are enabled', async () => {
    const { middleware } = makeMiddleware({
      contextData: {
        network: { origin: 'https://app.example.com' },
      } as Partial<RequestContext>,
      policy: { allowOrigins: ['*'], withCredentials: true },
    })
    const response = makeResponse()
    const next = vi.fn().mockResolvedValue(response)

    await middleware.execute(makeRequest(), next)

    expect(response.headers).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    })
  })

  it('adds headers when wildcard access is allowed without a request context', async () => {
    const { middleware } = makeMiddleware({ policy: { allowOrigins: ['*'] } })
    const response = makeResponse()
    const next = vi.fn().mockResolvedValue(response)

    await middleware.execute(makeRequest(), next)

    expect(response.headers).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'false',
      'Vary': 'Origin',
    })
  })
})

import type {
  IAllowMethod,
  INetworkContextAccessor,
  NetworkContext,
  RoutePolicy,
  XenoRequest,
} from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OptionsMiddleware } from '../options.middleware'

vi.mock('@xeno-js/shared', () => ({
  Guards: {
    isDefined: (value: unknown) => value !== undefined && value !== null,
  },
  HttpHelper: {
    success: vi.fn(
      (
        data: unknown,
        status: number,
        _metadata: Record<string, unknown>,
        headers: Record<string, string>,
      ) => ({ data, status, ok: status < 400, headers }),
    ),
  },
  STATUS_CODES: { NO_CONTENT: 204 },
}))

function makeMiddleware(
  options: {
    networkContext?: Partial<NetworkContext>
    policy?: RoutePolicy
    methods?: string
    allowHeaders?: string[]
    withCredentials?: 'true' | 'false'
  } = {},
) {
  const getNetworkContext = vi.fn().mockReturnValue(options.networkContext)
  const requestContext = { getNetworkContext } as unknown as INetworkContextAccessor
  const getMethods = vi.fn().mockReturnValue(options.methods ?? 'GET, POST')
  const allowMethod = { check: vi.fn(), getMethods } as unknown as IAllowMethod
  const checkRoutePolicy = vi.fn().mockReturnValue(options.policy ?? {})
  const getRouteMatcher = vi.fn(() => ({ checkRoutePolicy }))
  const middleware = new OptionsMiddleware(
    requestContext,
    allowMethod,
    getRouteMatcher,
    options.allowHeaders ?? ['Content-Type', 'Authorization'],
    options.withCredentials ?? 'false',
  )

  return { middleware, getNetworkContext, getMethods, getRouteMatcher, checkRoutePolicy }
}

function makeRequest(path: string, method: string, requestedMethod?: string): XenoRequest {
  const headers = new Headers(
    requestedMethod !== undefined
      ? { 'access-control-request-method': requestedMethod }
      : undefined,
  )
  return { path, method, headers } as unknown as XenoRequest
}

describe('OptionsMiddleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates non-OPTIONS requests to the next middleware without evaluating dependencies', async () => {
    const { middleware, getNetworkContext, getMethods, getRouteMatcher } = makeMiddleware()
    const response = { status: 200, ok: true, data: { ok: true } }
    const next = vi.fn().mockResolvedValue(response)

    const result = await middleware.execute(makeRequest('/api/test', 'get'), next)

    expect(result).toBe(response)
    expect(next).toHaveBeenCalledOnce()
    expect(getNetworkContext).not.toHaveBeenCalled()
    expect(getMethods).not.toHaveBeenCalled()
    expect(getRouteMatcher).not.toHaveBeenCalled()
  })

  it('uses the requested method and wildcard origin when credentials are disabled', async () => {
    const { middleware, getNetworkContext, getMethods, getRouteMatcher, checkRoutePolicy } =
      makeMiddleware({
        policy: { withCredentials: false, allowOrigins: ['*'] },
        methods: 'GET, POST, PUT',
        allowHeaders: ['Content-Type', 'X-Trace-Id'],
      })
    const next = vi.fn()

    const result = await middleware.execute(makeRequest('/api/test', 'OPTIONS', 'PATCH'), next)

    expect(result).toMatchObject({ status: 204, ok: true, data: null })
    expect(result.headers).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'false',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PUT',
      'Access-Control-Allow-Headers': 'Content-Type, X-Trace-Id',
    })
    expect(getNetworkContext).toHaveBeenCalledOnce()
    expect(getRouteMatcher).toHaveBeenCalledOnce()
    expect(checkRoutePolicy).toHaveBeenCalledWith('/api/test', 'PATCH')
    expect(getMethods).toHaveBeenCalledWith('/api/test')
    expect(next).not.toHaveBeenCalled()
  })

  it('handles lowercase OPTIONS and falls back to GET and configured credentials', async () => {
    const { middleware, checkRoutePolicy } = makeMiddleware({
      networkContext: { origin: 'https://app.example.com' },
      withCredentials: 'true',
    })

    const result = await middleware.execute(makeRequest('/api/private', 'options'), vi.fn())

    expect(checkRoutePolicy).toHaveBeenCalledWith('/api/private', 'GET')
    expect(result.headers).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    })
  })

  it('uses the request origin when the route enables credentials', async () => {
    const { middleware } = makeMiddleware({
      networkContext: { origin: 'https://app.example.com' },
      policy: { withCredentials: true, allowOrigins: ['*'] },
    })

    const result = await middleware.execute(makeRequest('/api/secure', 'OPTIONS'), vi.fn())

    expect(result.headers).toMatchObject({
      'Access-Control-Allow-Origin': 'https://app.example.com',
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    })
  })

  it('omits origin headers when there is no origin and wildcard access is not allowed', async () => {
    const { middleware } = makeMiddleware({
      policy: { allowOrigins: ['https://other.example.com'] },
      methods: 'GET, DELETE',
      allowHeaders: ['X-Request-Id'],
    })

    const result = await middleware.execute(makeRequest('/api/private', 'OPTIONS'), vi.fn())

    expect(result.headers).toEqual({
      'Access-Control-Allow-Methods': 'GET, DELETE',
      'Access-Control-Allow-Headers': 'X-Request-Id',
    })
  })
})

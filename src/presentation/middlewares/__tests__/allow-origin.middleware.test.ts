import type {
  IContextAccessor,
  ILogger,
  RequestContext,
  RoutePolicy,
  XenoRequest,
} from '@xeno-js/shared'
import type { IAllowOrigin } from '@xeno-js/shared'
import { ERROR_CODE_MESSAGES, ERROR_CODES, STATUS_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AllowOriginMiddleware } from '../allow-origin.middleware'

vi.mock('@xeno-js/shared', () => ({
  ERROR_CODE_MESSAGES: { FORBIDDEN: 'Forbidden' },
  ERROR_CODES: { FORBIDDEN: 'FORBIDDEN' },
  Guards: {
    isDefined: (value: unknown) => value !== undefined && value !== null,
  },
  GuidHelper: { generate: vi.fn(() => 'generated-id') },
  HttpHelper: {
    error: vi.fn((data: unknown, status: number) => {
      const responseData = data as {
        correlationId: string
        requestId: string
        spanId: string
      }
      return {
        data,
        status,
        ok: false,
        headers: {
          'X-Correlation-Id': [responseData.correlationId],
          'X-Request-Id': [responseData.requestId],
          'X-Span-Id': [responseData.spanId],
        },
      }
    }),
  },
  STATUS_CODES: { FORBIDDEN: 403 },
}))

function makeMiddleware(
  isAllowed: boolean,
  contextData?: Partial<RequestContext>,
  policy: RoutePolicy = {},
) {
  const getContext = vi.fn().mockReturnValue(contextData)
  const requestContext = { getContext } as unknown as IContextAccessor<RequestContext>
  const isAllowedMock = vi.fn().mockReturnValue(isAllowed)
  const allowOrigin = { isAllowed: isAllowedMock } as unknown as IAllowOrigin
  const warn = vi.fn()
  const logger = { warn } as unknown as ILogger
  const checkRoutePolicy = vi.fn().mockReturnValue(policy)
  const getRouteMatcher = vi.fn(() => ({ checkRoutePolicy }))
  const middleware = new AllowOriginMiddleware(allowOrigin, requestContext, logger, getRouteMatcher)

  return { middleware, isAllowedMock, getContext, warn, getRouteMatcher, checkRoutePolicy }
}

function makeRequest(path: string, method = 'GET'): XenoRequest {
  return { path, method } as unknown as XenoRequest
}

describe('AllowOriginMiddleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to the next middleware when the configured origin policy allows the request', async () => {
    const context = {
      network: { origin: 'https://app.example.com', requestId: 'req-123' },
      tracing: { correlationId: 'corr-123', spanId: 'span-123' },
    } as unknown as RequestContext
    const { middleware, isAllowedMock, warn, getContext, getRouteMatcher, checkRoutePolicy } =
      makeMiddleware(true, context)
    const nextResult = { status: 200, ok: true, data: { ok: true } }
    const next = vi.fn().mockResolvedValue(nextResult)

    const response = await middleware.execute(makeRequest('/api/ok', 'POST'), next)

    expect(response).toBe(nextResult)
    expect(getContext).toHaveBeenCalledOnce()
    expect(getRouteMatcher).toHaveBeenCalledOnce()
    expect(checkRoutePolicy).toHaveBeenCalledWith('/api/ok', 'POST')
    expect(isAllowedMock).toHaveBeenCalledWith('https://app.example.com')
    expect(next).toHaveBeenCalledOnce()
    expect(warn).not.toHaveBeenCalled()
  })

  it('blocks a disallowed origin and includes request context in the forbidden response', async () => {
    const context = {
      network: { origin: 'https://bad.example.com', requestId: 'req-456' },
      tracing: { correlationId: 'corr-456', spanId: 'span-456' },
    } as unknown as RequestContext
    const { middleware, isAllowedMock, warn } = makeMiddleware(false, context)
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('/api/blocked'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(response.ok).toBe(false)
    expect(next).not.toHaveBeenCalled()
    expect(isAllowedMock).toHaveBeenCalledWith('https://bad.example.com')
    expect(warn).toHaveBeenCalledWith(
      'Access denied by AllowOrigin policy for origin: https://bad.example.com',
    )
    expect(response.headers['X-Correlation-Id']).toEqual(['corr-456'])
    expect(response.headers['X-Request-Id']).toEqual(['req-456'])
    expect(response.headers['X-Span-Id']).toEqual(['span-456'])
    expect(response.data).toMatchObject({
      error: {
        code: ERROR_CODES.FORBIDDEN,
        message: ERROR_CODE_MESSAGES[ERROR_CODES.FORBIDDEN],
        details: "The origin 'https://bad.example.com' is not allowed to access this resource.",
        path: '/api/blocked',
      },
      correlationId: 'corr-456',
      requestId: 'req-456',
      spanId: 'span-456',
    })
  })

  it('uses an explicitly configured origin allowlist without calling the shared allow-origin policy', async () => {
    const context = {
      network: { origin: 'https://app.example.com' },
    } as unknown as RequestContext
    const { middleware, isAllowedMock } = makeMiddleware(false, context, {
      allowOrigins: ['https://app.example.com'],
    })
    const next = vi.fn().mockResolvedValue({ status: 200, ok: true })

    const result = await middleware.execute(makeRequest('/api/allowlisted'), next)

    expect(result).toEqual({ status: 200, ok: true })
    expect(isAllowedMock).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })

  it('allows any origin when the configured allowlist contains a wildcard', async () => {
    const { middleware, isAllowedMock } = makeMiddleware(false, undefined, {
      allowOrigins: ['*'],
    })
    const next = vi.fn().mockResolvedValue({ status: 204, ok: true })

    const result = await middleware.execute(makeRequest('/api/public'), next)

    expect(result).toEqual({ status: 204, ok: true })
    expect(isAllowedMock).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })

  it('blocks an origin not present in an explicit allowlist', async () => {
    const context = {
      network: { origin: 'https://bad.example.com' },
    } as unknown as RequestContext
    const { middleware, isAllowedMock, warn } = makeMiddleware(true, context, {
      allowOrigins: ['https://app.example.com'],
    })
    const next = vi.fn()

    const result = await middleware.execute(makeRequest('/api/restricted'), next)

    expect(result.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(result.data).toMatchObject({
      error: { path: '/api/restricted' },
    })
    expect(isAllowedMock).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(
      'Access denied by AllowOrigin policy for origin: https://bad.example.com',
    )
  })

  it('uses fallback identifiers and an empty origin for an empty explicit allowlist', async () => {
    const context = {} as RequestContext
    const { middleware, isAllowedMock } = makeMiddleware(true, context, { allowOrigins: [] })
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('/api/no-origin'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(isAllowedMock).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
    expect(response.data).toMatchObject({
      correlationId: 'generated-id',
      requestId: 'generated-id',
      spanId: 'generated-id',
      error: {
        details: "The origin 'unknown' is not allowed to access this resource.",
      },
    })
  })

  it('uses unknown origin and fallback identifiers when request context is missing', async () => {
    const { middleware, isAllowedMock, warn } = makeMiddleware(false)
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('/api/missing-context'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(response.ok).toBe(false)
    expect(next).not.toHaveBeenCalled()
    expect(isAllowedMock).toHaveBeenCalledWith(undefined)
    expect(warn).toHaveBeenCalledWith('Access denied by AllowOrigin policy for origin: unknown')
    expect(response.headers['X-Correlation-Id']).toEqual(['generated-id'])
    expect(response.headers['X-Request-Id']).toEqual(['generated-id'])
    expect(response.headers['X-Span-Id']).toEqual(['generated-id'])
    expect(response.data).toMatchObject({
      error: {
        code: ERROR_CODES.FORBIDDEN,
        details: "The origin 'unknown' is not allowed to access this resource.",
        path: '/api/missing-context',
      },
      correlationId: 'generated-id',
      requestId: 'generated-id',
      spanId: 'generated-id',
    })
  })
})

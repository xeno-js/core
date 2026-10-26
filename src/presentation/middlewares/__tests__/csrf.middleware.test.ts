import type {
  ICsrfTokenService,
  IRequestContext,
  NetworkContext,
  RequestContext,
  RoutePolicy,
  XenoRegistry,
  XenoRequest,
} from '@xeno-js/shared'
import type { ResponseDto } from '@xeno-js/shared'
import { ERROR_CODES, STATUS_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CsrfMiddleware } from '../csrf.middleware'

vi.mock('@xeno-js/shared', () => ({
  ERROR_CODE_MESSAGES: { FORBIDDEN: 'Forbidden' },
  ERROR_CODES: { FORBIDDEN: 'FORBIDDEN' },
  Guards: {
    isDefined: (value: unknown) => value !== undefined && value !== null,
  },
  GuidHelper: { generate: vi.fn(() => 'generated-id') },
  HttpHelper: {
    error: vi.fn((data: unknown, status: number, headers: Record<string, string[]>) => ({
      data,
      status,
      ok: false,
      headers,
    })),
  },
  STATUS_CODES: { FORBIDDEN: 403 },
}))

const path = '/api/test'

function makeRequest(method: string, requestPath = path): XenoRequest {
  return { path: requestPath, method } as unknown as XenoRequest
}

function makeContext(
  options: {
    csrf?: string
    csrfCookie?: string
    userId?: string
    requestId?: string
    correlationId?: string
    spanId?: string
    formatIndicator?: string
  } = {},
): RequestContext {
  return {
    network: {
      csrf: options.csrf,
      csrfCookie: options.csrfCookie,
      formatIndicator: options.formatIndicator,
      requestId: options.requestId,
    } as unknown as NetworkContext,
    identity: options.userId === undefined ? undefined : { userId: options.userId },
    tracing: {
      correlationId: options.correlationId,
      spanId: options.spanId,
    },
  } as unknown as RequestContext
}

function makeSuccessResponse(): ResponseDto {
  return {
    status: 200,
    ok: true,
    data: { success: true, data: { ok: true }, meta: {} },
    headers: {},
  }
}

function makeMiddleware(
  options: {
    context?: RequestContext
    policy?: RoutePolicy
    validToken?: boolean
  } = {},
) {
  const getContext = vi.fn().mockReturnValue(options.context)
  const contextAccessor = {
    getContext,
  } as unknown as IRequestContext<RequestContext, XenoRegistry>
  const validate = vi.fn().mockResolvedValue(options.validToken ?? true)
  const csrfTokenService = { validate } as unknown as ICsrfTokenService
  const checkRoutePolicy = vi.fn().mockReturnValue(options.policy ?? {})
  const getRouteMatcher = vi.fn(() => ({ checkRoutePolicy }))
  const middleware = new CsrfMiddleware(contextAccessor, csrfTokenService, getRouteMatcher)

  return { middleware, getContext, validate, getRouteMatcher, checkRoutePolicy }
}

describe('CsrfMiddleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes safe methods through without resolving context or route policy', async () => {
    const { middleware, getContext, validate, getRouteMatcher } = makeMiddleware()
    const nextResult = makeSuccessResponse()
    const next = vi.fn().mockResolvedValue(nextResult)

    const result = await middleware.execute(makeRequest('GET'), next)

    expect(result).toBe(nextResult)
    expect(next).toHaveBeenCalledOnce()
    expect(getContext).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
    expect(getRouteMatcher).not.toHaveBeenCalled()
  })

  it('allows a route that explicitly disables CSRF validation', async () => {
    const { middleware, getContext, validate, checkRoutePolicy } = makeMiddleware({
      policy: { withCsrf: false },
    })
    const nextResult = makeSuccessResponse()
    const next = vi.fn().mockResolvedValue(nextResult)

    const result = await middleware.execute(makeRequest('post'), next)

    expect(result).toBe(nextResult)
    expect(checkRoutePolicy).toHaveBeenCalledWith(path, 'POST')
    expect(getContext).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })

  it('validates matching tokens for state-changing requests', async () => {
    const { middleware, validate, checkRoutePolicy } = makeMiddleware({
      context: makeContext({
        csrf: 'token',
        csrfCookie: 'token',
        userId: 'user-1',
        formatIndicator: 'application/json',
      }),
      policy: { withCsrf: true },
    })
    const nextResult = makeSuccessResponse()
    const next = vi.fn().mockResolvedValue(nextResult)

    const result = await middleware.execute(makeRequest('PATCH'), next)

    expect(result).toBe(nextResult)
    expect(checkRoutePolicy).toHaveBeenCalledWith(path, 'PATCH')
    expect(validate).toHaveBeenCalledWith('token', 'user-1')
    expect(next).toHaveBeenCalledOnce()
  })

  it('returns forbidden when the header token is missing', async () => {
    const { middleware, validate } = makeMiddleware({
      context: makeContext({ csrfCookie: 'token', userId: 'user-1' }),
    })
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('POST'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(response.ok).toBe(false)
    expect(response.data).toMatchObject({
      error: { code: ERROR_CODES.FORBIDDEN, details: 'CSRF token missing', path },
    })
    expect(response.headers).toEqual({ 'Content-Type': ['application/json'] })
    expect(validate).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('returns forbidden when the cookie token is missing', async () => {
    const { middleware, validate } = makeMiddleware({
      context: makeContext({ csrf: 'token', userId: 'user-1' }),
    })
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('DELETE'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(response.data).toMatchObject({
      error: { details: 'CSRF token missing', path },
    })
    expect(validate).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('returns forbidden when header and cookie tokens do not match', async () => {
    const { middleware, validate } = makeMiddleware({
      context: makeContext({ csrf: 'header-token', csrfCookie: 'cookie-token', userId: 'user-1' }),
    })
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('PUT'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(response.data).toMatchObject({
      error: { details: 'CSRF token mismatch', path },
    })
    expect(validate).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects matching tokens when the user identity is missing', async () => {
    const { middleware, validate } = makeMiddleware({
      context: makeContext({ csrf: 'token', csrfCookie: 'token' }),
    })
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('POST'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(response.data).toMatchObject({
      error: { details: 'CSRF token invalid', path },
    })
    expect(validate).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects matching tokens when token validation fails', async () => {
    const { middleware, validate } = makeMiddleware({
      context: makeContext({
        csrf: 'token',
        csrfCookie: 'token',
        userId: 'user-1',
        formatIndicator: 'application/json',
      }),
      validToken: false,
    })
    const next = vi.fn()

    const response = await middleware.execute(makeRequest('POST'), next)

    expect(response.status).toBe(STATUS_CODES.FORBIDDEN)
    expect(response.data).toMatchObject({
      error: { details: 'CSRF token invalid', path },
    })
    expect(validate).toHaveBeenCalledWith('token', 'user-1')
    expect(next).not.toHaveBeenCalled()
  })

  it('uses fallback response identifiers when request context is missing', async () => {
    const { middleware } = makeMiddleware()

    const response = await middleware.execute(makeRequest('POST'), vi.fn())

    expect(response.data).toMatchObject({
      correlationId: 'generated-id',
      requestId: 'generated-id',
      spanId: 'generated-id',
      error: { details: 'CSRF token missing' },
    })
  })

  it('passes other methods through after state-changing validation is not required', async () => {
    const { middleware, getRouteMatcher, getContext, validate } = makeMiddleware()
    const nextResult = makeSuccessResponse()
    const next = vi.fn().mockResolvedValue(nextResult)

    const result = await middleware.execute(makeRequest('OPTIONS'), next)

    expect(result).toBe(nextResult)
    expect(next).toHaveBeenCalledOnce()
    expect(getRouteMatcher).not.toHaveBeenCalled()
    expect(getContext).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
  })
})

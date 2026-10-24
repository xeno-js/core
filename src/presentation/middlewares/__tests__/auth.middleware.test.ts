import type {
  IGateKeeper,
  ILogger,
  IServiceExtractor,
  Optional,
  RequestContext,
  XenoRequest,
} from '@xeno-js/shared'
import type { ApplicationRegistry, IRequestContext } from '@xeno-js/shared'
import { STATUS_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthenticationMiddleware } from '../auth.middleware'

function makeMiddleware(
  authResult: { isOk(): boolean; getErrorOrThrow?(): unknown; getValueOrThrow?(): unknown },
  contextData?: Partial<RequestContext>,
  token: Optional<string> = 'token-123',
) {
  const getContext = vi.fn().mockReturnValue(contextData)
  const updateIdentityMock = vi.fn()
  const requestContext = {
    getContext,
    updateIdentity: updateIdentityMock,
  } as unknown as IRequestContext<RequestContext, ApplicationRegistry<unknown>>

  const extractMock = vi.fn().mockReturnValue(token)
  const tokenExtractor = {
    extract: extractMock,
  } as unknown as IServiceExtractor<Request['headers'], Optional<string>>

  const authenticateMock = vi.fn().mockResolvedValue(authResult)
  const gateKeeper = { authenticate: authenticateMock } as unknown as IGateKeeper

  const warnMock = vi.fn()
  const logger = { warn: warnMock } as unknown as ILogger

  const middleware = new AuthenticationMiddleware(
    requestContext,
    tokenExtractor,
    gateKeeper,
    logger,
  )

  return {
    middleware,
    extractMock,
    authenticateMock,
    warnMock,
    getContext,
    updateIdentityMock,
  }
}

describe('AuthenticationMiddleware', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('authorizes a valid request and updates the request identity', async () => {
    const identity = {
      userId: '11111111-1111-4111-8111-111111111111' as const,
      tenantId: '22222222-2222-4222-8222-222222222222' as const,
      roles: [],
      permissions: [],
      email: 'admin@example.com',
      name: 'Admin',
    }

    const authResult = {
      isOk: () => true,
      getValueOrThrow: () => identity,
    }

    const context = {
      network: {
        requestId: '33333333-3333-4333-8333-333333333333',
        formatIndicator: 'application/json',
      },
      tracing: {
        correlationId: '44444444-4444-4444-8444-444444444444',
        spanId: '55555555-5555-4555-8555-555555555555',
      },
    } as unknown as Partial<RequestContext>

    const { middleware, extractMock, authenticateMock, updateIdentityMock, getContext } =
      makeMiddleware(authResult, context, 'valid-token')

    const req = {
      headers: new Headers({ Authorization: 'Bearer valid-token' }),
      path: '/api/protected',
    } as unknown as XenoRequest
    const nextResult = { status: 200, ok: true, data: { ok: true } }
    const next = vi.fn().mockResolvedValue(nextResult)

    const response = await middleware.execute(req, next)

    expect(response).toBe(nextResult)
    expect(extractMock).toHaveBeenCalledWith(req.headers)
    expect(authenticateMock).toHaveBeenCalledWith('valid-token')
    expect(getContext).not.toHaveBeenCalled()
    expect(updateIdentityMock).toHaveBeenCalledWith(identity)
    expect(next).toHaveBeenCalledOnce()
  })

  it('returns 401 when authentication fails', async () => {
    const error = {
      code: 'AUTH_FAILED',
      message: 'Invalid token',
      status: STATUS_CODES.UNAUTHORIZED,
    }

    const authResult = {
      isOk: () => false,
      getErrorOrThrow: () => error,
    }

    const context = {
      network: {
        requestId: '66666666-6666-4666-8666-666666666666',
        formatIndicator: 'application/json',
      },
      tracing: {
        correlationId: '77777777-7777-4777-8777-777777777777',
        spanId: '88888888-8888-4888-8888-888888888888',
      },
    } as unknown as Partial<RequestContext>

    const { middleware, warnMock } = makeMiddleware(authResult, context, 'bad-token')

    const req = {
      headers: new Headers({ Authorization: 'Bearer bad-token' }),
      path: '/api/protected',
    } as unknown as XenoRequest
    const next = vi.fn()

    const response = await middleware.execute(req, next)

    expect(response.status).toBe(STATUS_CODES.UNAUTHORIZED)
    expect(response.ok).toBe(false)
    expect(next).not.toHaveBeenCalled()
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('Authentication failed for request on path: /api/protected'),
    )
    expect((response.headers['Content-Type'] as string[] | undefined)?.[0]).toBe('application/json')
    expect(response.headers['X-Correlation-Id']).toEqual(['77777777-7777-4777-8777-777777777777'])
    expect(response.headers['X-Request-Id']).toEqual(['66666666-6666-4666-8666-666666666666'])
    expect(response.headers['X-Span-Id']).toEqual(['88888888-8888-4888-8888-888888888888'])

    const data = response.data as {
      error: { code: string; message: string; details: string; path: string }
      correlationId: string
      requestId: string
      spanId: string
    }

    expect(data.error.code).toBe('AUTH_FAILED')
    expect(data.error.message).toBe('Invalid token')
    expect(data.error.details).toBe(
      '[Authentication Error] Failed to authenticate request on path: /api/protected',
    )
    expect(data.error.path).toBe('/api/protected')
    expect(data.correlationId).toBe('77777777-7777-4777-8777-777777777777')
    expect(data.requestId).toBe('66666666-6666-4666-8666-666666666666')
    expect(data.spanId).toBe('88888888-8888-4888-8888-888888888888')
  })

  it('uses generated GUID fallbacks when the request context is absent', async () => {
    const error = {
      code: 'AUTH_FAILED',
      message: 'Missing token',
      status: STATUS_CODES.UNAUTHORIZED,
    }

    const authResult = {
      isOk: () => false,
      getErrorOrThrow: () => error,
    }

    const { middleware, warnMock } = makeMiddleware(authResult, undefined, undefined)

    const req = {
      headers: new Headers(),
      path: '/api/no-context',
    } as unknown as XenoRequest
    const next = vi.fn()

    const response = await middleware.execute(req, next)

    expect(response.status).toBe(STATUS_CODES.UNAUTHORIZED)
    expect(response.ok).toBe(false)
    expect(next).not.toHaveBeenCalled()
    expect(warnMock).toHaveBeenCalledWith(
      expect.stringContaining('Authentication failed for request on path: /api/no-context'),
    )

    const correlationHeader = response.headers['X-Correlation-Id'] as string[] | undefined
    const requestHeader = response.headers['X-Request-Id'] as string[] | undefined
    const spanHeader = response.headers['X-Span-Id'] as string[] | undefined

    expect(correlationHeader).toBeDefined()
    expect(requestHeader).toBeDefined()
    expect(spanHeader).toBeDefined()
    expect(correlationHeader?.[0]).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(requestHeader?.[0]).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(spanHeader?.[0]).toMatch(/^[0-9a-fA-F-]{36}$/)

    const data = response.data as {
      error: { code: string; details: string; path: string }
      correlationId: string
      requestId: string
      spanId: string
    }

    expect(data.error.code).toBe('AUTH_FAILED')
    expect(data.error.details).toBe(
      '[Authentication Error] Failed to authenticate request on path: /api/no-context',
    )
    expect(data.error.path).toBe('/api/no-context')
    expect(data.correlationId).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(data.requestId).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(data.spanId).toMatch(/^[0-9a-fA-F-]{36}$/)
  })
})

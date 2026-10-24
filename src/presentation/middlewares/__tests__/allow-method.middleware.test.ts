import type { RequestContext, XenoRequest } from '@xeno-js/shared'
import type { ApplicationRegistry, IAllowMethod, IRequestContext } from '@xeno-js/shared'
import { ERROR_CODE_MESSAGES, ERROR_CODES, STATUS_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MethodCheckMiddleware } from '../allow-method.middleware'

function makeMiddleware(
  isAllowed: boolean,
  contextData?: Partial<RequestContext>,
  allowedMethods = 'GET, POST',
) {
  const getContext = vi.fn().mockReturnValue(contextData)
  const requestContext = { getContext } as unknown as IRequestContext<
    RequestContext,
    ApplicationRegistry<unknown>
  >

  const checkMock = vi.fn().mockReturnValue(isAllowed)
  const getMethodsMock = vi.fn().mockReturnValue(allowedMethods)
  const allowMethod = {
    check: checkMock,
    getMethods: getMethodsMock,
  } as unknown as IAllowMethod

  const middleware = new MethodCheckMiddleware(requestContext, allowMethod)

  return { middleware, checkMock, getMethodsMock, getContext }
}

describe('MethodCheckMiddleware', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('passes through when the HTTP method is allowed', async () => {
    const nextResult = { status: 200, ok: true, data: { ok: true } }
    const { middleware, checkMock } = makeMiddleware(true)
    const req = { path: '/api/users', method: 'GET' } as unknown as XenoRequest
    const next = vi.fn().mockResolvedValue(nextResult)

    const response = await middleware.execute(req, next)

    expect(response).toBe(nextResult)
    expect(checkMock).toHaveBeenCalledWith('/api/users', 'GET')
    expect(next).toHaveBeenCalledOnce()
  })

  it('returns 405 when the method is not allowed and the context is available', async () => {
    const context = {
      network: { requestId: 'req-123' },
      tracing: { correlationId: 'corr-123', spanId: 'span-123' },
    } as unknown as RequestContext

    const { middleware, getMethodsMock, getContext } = makeMiddleware(false, context, 'GET, POST')
    const req = { path: '/api/users', method: 'DELETE' } as unknown as XenoRequest
    const next = vi.fn()

    const response = await middleware.execute(req, next)

    expect(response.status).toBe(STATUS_CODES.NOT_ALLOWED)
    expect(response.ok).toBe(false)
    expect(next).not.toHaveBeenCalled()
    expect(getContext).toHaveBeenCalledOnce()
    expect(getMethodsMock).toHaveBeenCalledWith('/api/users')
    expect(response.headers['X-Correlation-Id']).toEqual(['corr-123'])
    expect(response.headers['X-Request-Id']).toEqual(['req-123'])
    expect(response.headers['X-Span-Id']).toEqual(['span-123'])

    const data = response.data as {
      error: { code: string; message: string; details: string; path: string }
      correlationId: string
      requestId: string
      spanId: string
    }

    expect(data.error.code).toBe(ERROR_CODES.NOT_ALLOWED)
    expect(data.error.message).toBe(ERROR_CODE_MESSAGES[ERROR_CODES.NOT_ALLOWED])
    expect(data.error.details).toBe('Operation blocked by allow method middleware')
    expect(data.error.path).toBe('/api/users')
    expect(data.correlationId).toBe('corr-123')
    expect(data.requestId).toBe('req-123')
    expect(data.spanId).toBe('span-123')
  })

  it('generates fallback identifiers when the request context is missing', async () => {
    const { middleware, checkMock } = makeMiddleware(false, undefined, 'GET, POST')
    const req = { path: '/api/users', method: 'DELETE' } as unknown as XenoRequest
    const next = vi.fn()

    const response = await middleware.execute(req, next)

    expect(checkMock).toHaveBeenCalledWith('/api/users', 'DELETE')
    expect(response.status).toBe(STATUS_CODES.NOT_ALLOWED)
    expect(response.ok).toBe(false)
    expect(next).not.toHaveBeenCalled()
    expect(response.headers['X-Correlation-Id']?.[0]).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(response.headers['X-Request-Id']?.[0]).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(response.headers['X-Span-Id']?.[0]).toMatch(/^[0-9a-fA-F-]{36}$/)

    const data = response.data as {
      error: { code: string; details: string; path: string }
      correlationId: string
      requestId: string
      spanId: string
    }

    expect(data.error.code).toBe(ERROR_CODES.NOT_ALLOWED)
    expect(data.error.details).toBe('Operation blocked by allow method middleware')
    expect(data.error.path).toBe('/api/users')
    expect(data.correlationId).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(data.requestId).toMatch(/^[0-9a-fA-F-]{36}$/)
    expect(data.spanId).toMatch(/^[0-9a-fA-F-]{36}$/)
  })
})

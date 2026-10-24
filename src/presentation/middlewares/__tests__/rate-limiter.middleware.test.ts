import type { IContextAccessor, ILogger, RequestContext, XenoRequest } from '@xeno-js/shared'
import type { IAtomicCache, IRateLimitKeyBuilder } from '@xeno-js/shared'
import { ERROR_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RateLimitMiddleware } from '../rate-limiter.middleware'

const headers: Request['headers'] = new Headers({ Authorization: 'Bearer tok' })
const path = '/api/test'
const method = 'GET'
const transport = {
  req: {
    path,
    method,
    headers,
  } as unknown as XenoRequest,
}

function makeMiddleware(
  currentHits = 1,
  maxRequests = 3,
  mockCacheKey: string | undefined = 'ratelimit:ip:127.0.0.1:/api/test',
) {
  const increment = vi.fn().mockResolvedValue(currentHits)
  const cache = { increment } as unknown as IAtomicCache

  const getContext = vi.fn().mockReturnValue({
    network: { clientIp: '127.0.0.1', formatIndicator: 'application/json', requestId: 'req-id' },
    tracing: { correlationId: 'corr-id', spanId: 'span-id' },
  })
  const ctxAccessor = { getContext } as unknown as IContextAccessor<RequestContext>
  const keyBuilder = {
    buildRateLimitKey: vi.fn().mockReturnValue(mockCacheKey),
  } as unknown as IRateLimitKeyBuilder

  const warn = vi.fn()
  const logger: ILogger = { info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() }

  const middleware = new RateLimitMiddleware(ctxAccessor, cache, keyBuilder, logger, {
    maxRequests,
    windowSeconds: 60,
  })

  return { middleware, increment, warn }
}

describe('RateLimitMiddleware', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('allows request and calls next when hits are below or equal to maxRequests', async () => {
    const { middleware, increment } = makeMiddleware(2, 3) // 2 hits, max 3
    const next = vi.fn().mockResolvedValue({ status: 200, ok: true, data: {} })

    const response = await middleware.execute(transport.req, next)

    expect(response.ok).toBe(true)
    expect(increment).toHaveBeenCalledOnce()
    expect(increment).toHaveBeenCalledWith('ratelimit:ip:127.0.0.1:/api/test', 60)
    expect(next).toHaveBeenCalledOnce()
  })

  it('blocks request and returns 429 when hits exceed maxRequests', async () => {
    const { middleware, increment, warn } = makeMiddleware(4, 3) // 4 hits, max 3
    const next = vi.fn()

    const response = await middleware.execute(transport.req, next)

    expect(response.status).toBe(429)
    expect(response.ok).toBe(false)
    expect(increment).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledOnce()
    expect(next).not.toHaveBeenCalled()

    const data = response.data as { success: boolean; error: { code: string } }
    expect(data.error.code).toBe(ERROR_CODES.TOO_MANY_REQUESTS)
    expect(response.headers['Retry-After']).toEqual(['60'])
  })

  it('returns error 503 when cache key builder returns undefined is undefined', async () => {
    const increment = vi.fn().mockResolvedValue(1)
    const cache = { increment } as unknown as IAtomicCache
    const ctxAccessor = {
      getContext: vi.fn().mockReturnValue(undefined),
    } as unknown as IContextAccessor<RequestContext>
    const logger: ILogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
    const keyBuilder = {
      buildRateLimitKey: vi.fn().mockReturnValue(undefined),
    } as unknown as IRateLimitKeyBuilder

    const middleware = new RateLimitMiddleware(ctxAccessor, cache, keyBuilder, logger, {
      maxRequests: 3,
      windowSeconds: 60,
    })

    const next = vi.fn().mockResolvedValue({ status: 200, ok: true, data: {} })
    const response = await middleware.execute(transport.req, next)

    expect(response.ok).toBe(false)
    expect(response.status).toBe(503)
  })
})

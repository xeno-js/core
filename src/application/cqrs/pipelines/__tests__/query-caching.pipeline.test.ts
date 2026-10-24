import type { ICache, ICacheKeyBuilder, ILogger, IQuery } from '@xeno-js/shared'
import { Result } from '@xeno-js/shared'
import { REQUEST_TYPE } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { QueryCachingPipeline } from '../query-caching.pipeline'

const createCache = () => {
  const getMock = vi.fn()
  const setMock = vi.fn()
  const cache: ICache = {
    get: getMock,
    set: setMock,
    setIfAbsent: vi.fn(),
    remove: vi.fn(),
    has: vi.fn(),
    clear: vi.fn(),
    removePattern: vi.fn(),
  }
  return { cache, getMock, setMock }
}

const createCacheKeyBuilder = () => {
  const buildContextualKeyMock = vi.fn((key: string) => `contextual:${key}`)
  const buildUserScopedKeyMock = vi.fn((key: string) => `user-scoped:${key}`)
  const cacheKeyBuilder: ICacheKeyBuilder = {
    buildContextualKey: buildContextualKeyMock,
    buildUserScopedKey: buildUserScopedKeyMock,
  }
  return { cacheKeyBuilder, buildContextualKeyMock, buildUserScopedKeyMock }
}

const createLogger = () => {
  const warnMock = vi.fn()
  const debugMock = vi.fn()
  const logger: ILogger = {
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    debug: debugMock,
  }
  return { logger, warnMock, debugMock }
}

const makeRequest = (overrides?: Partial<IQuery['cacheOptions']>): IQuery<{ id: string }> => ({
  intent: 'TestQuery',
  type: REQUEST_TYPE.QUERY,
  cacheOptions: {
    cacheKey: 'test-key',
    ttl: 60,
    bypassCache: undefined,
    consistentRead: undefined,
    isUserScoped: false,
    ...overrides,
  },
})

describe('QueryCachingPipeline', () => {
  describe('handle', () => {
    it('bypasses cache and calls next when cacheKey is empty', async () => {
      const { cache, getMock } = createCache()
      const { logger } = createLogger()
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('value'))
      const request = makeRequest({ cacheKey: '' })

      const result = await pipeline.handle(request, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(result.isOk()).toBe(true)
      expect(getMock).not.toHaveBeenCalled()
    })

    it('returns cached value on cache hit', async () => {
      const { cache, getMock } = createCache()
      const { logger, debugMock } = createLogger()
      getMock.mockResolvedValue('cached-value')
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn()
      const request = makeRequest()

      const result = await pipeline.handle(request, next)

      expect(next).not.toHaveBeenCalled()
      expect(result.isOk()).toBe(true)
      expect(result.getValueOrThrow()).toBe('cached-value')
      expect(debugMock).toHaveBeenCalledWith(expect.stringContaining('Cache HIT'))
    })

    it('calls next on cache miss and stores result', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger, debugMock } = createLogger()
      getMock.mockResolvedValue(undefined)
      setMock.mockResolvedValue(undefined)
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('db-value'))
      const request = makeRequest()

      const result = await pipeline.handle(request, next)

      expect(next).toHaveBeenCalledTimes(1)
      expect(result.isOk()).toBe(true)
      expect(result.getValueOrThrow()).toBe('db-value')
      expect(setMock).toHaveBeenCalledWith('contextual:test-key', 'db-value', 60)
      expect(debugMock).toHaveBeenCalledWith(expect.stringContaining('Cache SET'))
    })

    it('does not store result in cache when handler fails', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger } = createLogger()
      getMock.mockResolvedValue(undefined)
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const appError = { message: 'err' } as never
      const next = vi.fn().mockResolvedValue(Result.fail(appError))
      const request = makeRequest()

      const result = await pipeline.handle(request, next)

      expect(result.isOk()).toBe(false)
      expect(setMock).not.toHaveBeenCalled()
    })

    it('bypasses cache read when bypassCache is true', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger } = createLogger()
      setMock.mockResolvedValue(undefined)
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('fresh-value'))
      const request = makeRequest({ bypassCache: true })

      const result = await pipeline.handle(request, next)

      expect(getMock).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.getValueOrThrow()).toBe('fresh-value')
    })

    it('bypasses cache read when consistentRead is true', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger } = createLogger()
      setMock.mockResolvedValue(undefined)
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('fresh-value'))
      const request = makeRequest({ consistentRead: true })

      const result = await pipeline.handle(request, next)

      expect(getMock).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.getValueOrThrow()).toBe('fresh-value')
    })

    it('logs warning and proceeds to DB when cache.get throws', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger, warnMock } = createLogger()
      getMock.mockRejectedValue(new Error('redis down'))
      setMock.mockResolvedValue(undefined)
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('db-value'))
      const request = makeRequest()

      const result = await pipeline.handle(request, next)

      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('Cache ERROR'))
      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('redis down'))
      expect(next).toHaveBeenCalledTimes(1)
      expect(result.getValueOrThrow()).toBe('db-value')
    })

    it('logs warning when cache.set throws but still returns result', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger, warnMock } = createLogger()
      getMock.mockResolvedValue(undefined)
      setMock.mockRejectedValue(new Error('write fail'))
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('db-value'))
      const request = makeRequest()

      const result = await pipeline.handle(request, next)

      expect(result.isOk()).toBe(true)
      expect(result.getValueOrThrow()).toBe('db-value')
      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('Cache ERROR'))
      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('write fail'))
    })

    it('logs warning with non-Error object when cache.get throws non-Error', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger, warnMock } = createLogger()
      getMock.mockRejectedValue('string error')
      setMock.mockResolvedValue(undefined)
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('db-value'))
      const request = makeRequest()

      await pipeline.handle(request, next)

      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('string error'))
    })

    it('logs warning with non-Error object when cache.set throws non-Error', async () => {
      const { cache, getMock, setMock } = createCache()
      const { logger, warnMock } = createLogger()
      getMock.mockResolvedValue(undefined)
      setMock.mockRejectedValue('write string error')
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('db-value'))
      const request = makeRequest()

      await pipeline.handle(request, next)

      expect(warnMock).toHaveBeenCalledWith(expect.stringContaining('write string error'))
    })

    it('stores result in cache when bypassCache is true and handler succeeds', async () => {
      const { cache, setMock } = createCache()
      const { logger } = createLogger()
      setMock.mockResolvedValue(undefined)
      const { cacheKeyBuilder } = createCacheKeyBuilder()
      const pipeline = new QueryCachingPipeline(cache, cacheKeyBuilder, logger)
      const next = vi.fn().mockResolvedValue(Result.ok('value'))
      const request = makeRequest({ bypassCache: true })

      await pipeline.handle(request, next)

      expect(setMock).toHaveBeenCalledWith('contextual:test-key', 'value', 60)
    })
  })
})

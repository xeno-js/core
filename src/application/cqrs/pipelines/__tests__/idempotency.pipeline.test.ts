import type {
  ICommand,
  IIdempotencyStore,
  INetworkContextAccessor,
  ResultType,
} from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'
import { ERROR_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import { IdempotencyPipeline } from '../idempotency.pipeline'

type NextFn = () => Promise<ResultType<string>>

const makeContext = (requestId = 'req-123') => ({ requestId })

const makeRequestContext = (requestId = 'req-123'): INetworkContextAccessor => ({
  getNetworkContext: vi.fn().mockReturnValue(makeContext(requestId)),
})

const makeStore = (): {
  [K in keyof IIdempotencyStore]: Mock
} => ({
  hasBeenProcessed: vi.fn(),
  getPayload: vi.fn(),
  acquireLock: vi.fn(),
  markAsProcessed: vi.fn(),
  releaseLock: vi.fn(),
})

const makeCommand = (): ICommand => ({ intent: 'TestCommand', type: 'COMMAND' })

describe('IdempotencyPipeline', () => {
  let store: ReturnType<typeof makeStore>
  let requestContext: INetworkContextAccessor
  let next: Mock<NextFn>
  let command: ICommand

  beforeEach(() => {
    store = makeStore()
    requestContext = makeRequestContext()
    next = vi.fn<NextFn>().mockResolvedValue(Result.ok('value'))
    command = makeCommand()
    vi.clearAllMocks()
  })

  // -- Constructor ------------------------------------------------------------

  describe('constructor', () => {
    it('should create with default TTL values', () => {
      expect(
        () => new IdempotencyPipeline(requestContext, store as unknown as IIdempotencyStore),
      ).not.toThrow()
    })

    it('should create with custom TTL values', () => {
      expect(
        () =>
          new IdempotencyPipeline(requestContext, store as unknown as IIdempotencyStore, {
            lockTtlSeconds: 10,
            processedTtlSeconds: 100,
          }),
      ).not.toThrow()
    })
  })

  // -- handle: missing context ------------------------------------------------

  describe('handle - missing context', () => {
    it('should return CONFLICT if getContext() returns null', async () => {
      const ctx = {
        getNetworkContext: vi.fn().mockReturnValue(null),
      } as unknown as INetworkContextAccessor
      const pipeline = new IdempotencyPipeline(ctx, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.CONFLICT)
    })

    it('should return CONFLICT if getNetworkContext() returns undefined context', async () => {
      const ctx = {
        getNetworkContext: vi.fn().mockReturnValue({ context: undefined }),
      } as unknown as INetworkContextAccessor
      const pipeline = new IdempotencyPipeline(ctx, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.CONFLICT)
    })
  })

  // -- handle: already processed ----------------------------------------------

  describe('handle - already processed', () => {
    it('should return stored payload if command has been processed', async () => {
      store.hasBeenProcessed.mockResolvedValue(true)
      store.getPayload.mockResolvedValue('cached-result')
      const pipeline = new IdempotencyPipeline(requestContext, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(true)
      expect(result.getValueOrThrow()).toBe('cached-result')
      expect(next).not.toHaveBeenCalled()
    })

    it('should return CONFLICT if processed but payload is undefined', async () => {
      store.hasBeenProcessed.mockResolvedValue(true)
      store.getPayload.mockResolvedValue(undefined)
      const pipeline = new IdempotencyPipeline(requestContext, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.CONFLICT)
      expect(next).not.toHaveBeenCalled()
    })

    it('should return CONFLICT if processed but payload is null', async () => {
      store.hasBeenProcessed.mockResolvedValue(true)
      store.getPayload.mockResolvedValue(null)
      const pipeline = new IdempotencyPipeline(requestContext, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.CONFLICT)
    })
  })

  // -- handle: lock not acquired ----------------------------------------------

  describe('handle - lock not acquired', () => {
    it('should return CONFLICT if lock cannot be acquired', async () => {
      store.hasBeenProcessed.mockResolvedValue(false)
      store.acquireLock.mockResolvedValue(false)
      const pipeline = new IdempotencyPipeline(requestContext, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.CONFLICT)
      expect(next).not.toHaveBeenCalled()
    })
  })

  // -- handle: successful processing -----------------------------------------

  describe('handle - successful processing', () => {
    it('should use intent-specific TTLs when configured', async () => {
      store.hasBeenProcessed.mockResolvedValue(false)
      store.acquireLock.mockResolvedValue(true)
      const pipeline = new IdempotencyPipeline(requestContext, store, {
        lockTtlSeconds: 10,
        processedTtlSeconds: 100,
        intentRegistry: {
          TestCommand: {
            lockTtlSeconds: 5,
            processedTtlSeconds: 50,
          },
        },
      })

      await pipeline.handle(command, next)

      expect(store.acquireLock).toHaveBeenCalledWith('req-123', 5)
      expect(store.markAsProcessed).toHaveBeenCalledWith('req-123', 'value', 50)
    })

    it('should fall back to pipeline TTLs when intent TTLs are not configured', async () => {
      store.hasBeenProcessed.mockResolvedValue(false)
      store.acquireLock.mockResolvedValue(true)
      const pipeline = new IdempotencyPipeline(requestContext, store, {
        lockTtlSeconds: 10,
        processedTtlSeconds: 100,
        intentRegistry: {},
      })

      await pipeline.handle(command, next)

      expect(store.acquireLock).toHaveBeenCalledWith('req-123', 10)
      expect(store.markAsProcessed).toHaveBeenCalledWith('req-123', 'value', 100)
    })
    it('should process command, mark as processed and return result', async () => {
      store.hasBeenProcessed.mockResolvedValue(false)
      store.acquireLock.mockResolvedValue(true)
      store.markAsProcessed.mockResolvedValue(undefined)
      next.mockResolvedValue(Result.ok('done'))
      const pipeline = new IdempotencyPipeline(requestContext, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(true)
      expect(result.getValueOrThrow()).toBe('done')
      expect(store.markAsProcessed).toHaveBeenCalledWith('req-123', 'done', expect.any(Number))
      expect(store.releaseLock).not.toHaveBeenCalled()
    })

    it('should release lock if next() returns failure', async () => {
      store.hasBeenProcessed.mockResolvedValue(false)
      store.acquireLock.mockResolvedValue(true)
      store.releaseLock.mockResolvedValue(undefined)
      next.mockResolvedValue(
        Result.fail(
          AppError.create({
            code: 'ERR',
            message: 'fail',
            status: 500,
            name: 'TestCommand',
            cause: new Error('x'),
          }),
        ),
      )
      const pipeline = new IdempotencyPipeline(requestContext, store)

      const result = await pipeline.handle(command, next)

      expect(result.isOk()).toBe(false)
      expect(store.releaseLock).toHaveBeenCalledWith('req-123')
      expect(store.markAsProcessed).not.toHaveBeenCalled()
    })
  })

  // -- handle: exception during processing -----------------------------------

  describe('handle - exception during processing', () => {
    it('should release lock and rethrow if next() throws', async () => {
      store.hasBeenProcessed.mockResolvedValue(false)
      store.acquireLock.mockResolvedValue(true)
      store.releaseLock.mockResolvedValue(undefined)
      next.mockRejectedValue(new Error('boom'))
      const pipeline = new IdempotencyPipeline(requestContext, store)

      await expect(pipeline.handle(command, next)).rejects.toThrow('boom')
      expect(store.releaseLock).toHaveBeenCalledWith('req-123')
    })
  })
})

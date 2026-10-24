import type { IRequest, ResultType } from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'
import { ERROR_CODES, PromiseHelper, STATUS_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import { ConcurrencyRetryPipeline } from '../concurrency-retry.pipeline'

type NextFn = () => Promise<ResultType<string>>

vi.mock('@xeno-js/shared', async () => {
  const actual = await vi.importActual('@xeno-js/shared')
  return {
    ...actual,
    GuidHelper: {
      isValidGuid: vi.fn(),
    },
    PromiseHelper: {
      delayWithJitter: vi.fn().mockResolvedValue(undefined),
    },
  }
})

describe('ConcurrencyRetryPipeline', () => {
  let mockNext: Mock<NextFn>
  const mockRequest: IRequest<{ id: string }> = {
    intent: 'TestCommand',
    type: 'COMMAND',
  }

  beforeEach(() => {
    mockNext = vi.fn<NextFn>()
    vi.clearAllMocks()
  })

  it('should return result immediately if successful', async () => {
    mockNext.mockResolvedValue(Result.ok('success'))
    const pipeline = new ConcurrencyRetryPipeline({
      maxRetries: 3,
    })

    const result = await pipeline.handle(mockRequest, mockNext)

    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(result.getValueOrThrow()).toBe('success')
    expect(PromiseHelper.delayWithJitter).not.toHaveBeenCalled()
  })

  it('should not retry if error is NOT a concurrency conflict', async () => {
    const nonConcurrencyError: ResultType<string> = Result.fail(
      AppError.create({
        code: 'VALIDATION_ERROR',
        status: STATUS_CODES.BAD_REQUEST,
        name: 'TestCommand',
        message: 'Invalid',
        cause: new Error('Some validation error'),
      }),
    )

    mockNext.mockResolvedValue(nonConcurrencyError)
    const pipeline = new ConcurrencyRetryPipeline({
      maxRetries: 3,
    })

    const result = await pipeline.handle(mockRequest, mockNext)

    expect(mockNext).toHaveBeenCalledTimes(1)
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).not.toBe(ERROR_CODES.CONFLICT)
  })

  it('should retry on concurrency conflict and succeed eventually', async () => {
    const conflictError: ResultType<string> = Result.fail(
      AppError.create({
        code: ERROR_CODES.CONFLICT,
        status: STATUS_CODES.CONFLICT,
        name: 'TestCommand',
        message: 'Conflict',
        cause: new Error('Concurrency conflict occurred'),
      }),
    )

    mockNext
      .mockResolvedValueOnce(conflictError)
      .mockResolvedValueOnce(conflictError)
      .mockResolvedValueOnce(Result.ok('success'))

    const pipeline = new ConcurrencyRetryPipeline({
      maxRetries: 3,
    })
    const result = await pipeline.handle(mockRequest, mockNext)

    expect(mockNext).toHaveBeenCalledTimes(3)
    expect(PromiseHelper.delayWithJitter).toHaveBeenCalledTimes(2)
    expect(result.getValueOrThrow()).toBe('success')
  })

  it('should fail after max retries exceeded', async () => {
    const conflictError: ResultType<string> = Result.fail(
      AppError.create({
        code: ERROR_CODES.CONFLICT,
        status: STATUS_CODES.CONFLICT,
        name: 'TestCommand',
        message: 'Conflict',
        cause: new Error('Concurrency conflict occurred'),
      }),
    )

    mockNext.mockResolvedValue(conflictError)
    const maxRetries = 2
    const pipeline = new ConcurrencyRetryPipeline({
      maxRetries,
    })

    const result = await pipeline.handle(mockRequest, mockNext)

    expect(mockNext).toHaveBeenCalledTimes(maxRetries)
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.CONFLICT)
  })
})

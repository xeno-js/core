import type {
  ICommand,
  IHandler,
  IPipelineBehavior,
  IQuery,
  IRequest,
  ResultType,
} from '@xeno-js/shared'
import type { IServiceScope, IServiceScopeAccessor, XenoRegistry } from '@xeno-js/shared'
import { AppError, ERROR_CODES, Result } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { Mediator } from '../mediator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Registry = XenoRegistry

interface TestResponse {
  value: string
}

function makeCommand(intent = 'TestCommand'): ICommand<TestResponse> {
  return { intent } as ICommand<TestResponse>
}

function makeQuery(intent = 'TestQuery'): IQuery<TestResponse> {
  return { intent } as IQuery<TestResponse>
}

function makeSignal(aborted = false): AbortSignal {
  const controller = new AbortController()
  if (aborted) controller.abort()
  return controller.signal
}

function makeScope(resolveMap: Partial<Record<string, unknown>> = {}): IServiceScope<Registry> {
  return {
    resolve: vi.fn((token: string) => resolveMap[token]),
    dispose: vi.fn(),
  } as unknown as IServiceScope<Registry>
}

function makeAccessor(scope: IServiceScope<Registry> | undefined): IServiceScopeAccessor<Registry> {
  return { getScope: vi.fn().mockReturnValue(scope) }
}

function makePipeline(
  handler: (
    req: IRequest<TestResponse>,
    next: () => Promise<ResultType<TestResponse>>,
  ) => Promise<ResultType<TestResponse>>,
): IPipelineBehavior<IRequest<TestResponse>, TestResponse> {
  return { handle: vi.fn(handler) }
}

function makeHandler(
  result: ResultType<TestResponse>,
): IHandler<IRequest<TestResponse>, TestResponse> {
  return { handle: vi.fn().mockResolvedValue(result) }
}

// ---------------------------------------------------------------------------
// send (command)
// ---------------------------------------------------------------------------

describe('Mediator – send (command)', () => {
  it('returns aborted failure when signal is already aborted', async () => {
    const mediator = new Mediator(makeAccessor(makeScope()))
    const result = await mediator.send(makeCommand('Cmd'), makeSignal(true))
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.ABORTED)
  })

  it('returns SCOPE_NOT_AVAILABLE failure when scope is undefined', async () => {
    const mediator = new Mediator(makeAccessor(undefined))
    const result = await mediator.send(makeCommand(), makeSignal())
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.SCOPE_NOT_AVAILABLE)
  })

  it('returns PIPELINE_NOT_AVAILABLE when pipeline resolves to undefined', async () => {
    const scope = makeScope({ [TOKENS.COMMAND_PIPELINES_BEHAVIOR]: undefined })
    const mediator = new Mediator(makeAccessor(scope))
    const result = await mediator.send(makeCommand(), makeSignal())
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.PIPELINE_NOT_AVAILABLE)
  })

  it('returns PIPELINE_NOT_AVAILABLE when pipeline has no handle method', async () => {
    const scope = makeScope({ [TOKENS.COMMAND_PIPELINES_BEHAVIOR]: {} })
    const mediator = new Mediator(makeAccessor(scope))
    const result = await mediator.send(makeCommand(), makeSignal())
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.PIPELINE_NOT_AVAILABLE)
  })

  it('returns handler result on happy path', async () => {
    const intent = 'TestCommand'
    const handler = makeHandler(Result.ok<TestResponse>({ value: 'ok' }))
    const pipeline = makePipeline((_req, next) => next())
    const scope = makeScope({
      [TOKENS.COMMAND_PIPELINES_BEHAVIOR]: pipeline,
      [intent]: handler,
    })
    const mediator = new Mediator(makeAccessor(scope))
    const result = await mediator.send(makeCommand(intent), makeSignal())
    expect(result.isOk()).toBe(true)
  })

  it('throws AppError when handler is not found in scope', async () => {
    const intent = 'MissingHandler'
    const pipeline = makePipeline((_req, next) => next())
    const scope = makeScope({
      [TOKENS.COMMAND_PIPELINES_BEHAVIOR]: pipeline,
      [intent]: undefined,
    })
    const mediator = new Mediator(makeAccessor(scope))
    await expect(mediator.send(makeCommand(intent), makeSignal())).rejects.toBeInstanceOf(AppError)
  })

  it('throws AppError when handler has no handle method', async () => {
    const intent = 'BadHandler'
    const pipeline = makePipeline((_req, next) => next())
    const scope = makeScope({
      [TOKENS.COMMAND_PIPELINES_BEHAVIOR]: pipeline,
      [intent]: {},
    })
    const mediator = new Mediator(makeAccessor(scope))
    await expect(mediator.send(makeCommand(intent), makeSignal())).rejects.toBeInstanceOf(AppError)
  })
})

// ---------------------------------------------------------------------------
// query
// ---------------------------------------------------------------------------

describe('Mediator – query', () => {
  it('returns aborted failure when signal is already aborted', async () => {
    const mediator = new Mediator(makeAccessor(makeScope()))
    const result = await mediator.query(makeQuery('Q'), makeSignal(true))
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.ABORTED)
  })

  it('returns SCOPE_NOT_AVAILABLE failure when scope is undefined', async () => {
    const mediator = new Mediator(makeAccessor(undefined))
    const result = await mediator.query(makeQuery(), makeSignal())
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.SCOPE_NOT_AVAILABLE)
  })

  it('returns PIPELINE_NOT_AVAILABLE when query pipeline resolves to undefined', async () => {
    const scope = makeScope({ [TOKENS.QUERY_PIPELINES_BEHAVIOR]: undefined })
    const mediator = new Mediator(makeAccessor(scope))
    const result = await mediator.query(makeQuery(), makeSignal())
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.PIPELINE_NOT_AVAILABLE)
  })

  it('returns PIPELINE_NOT_AVAILABLE when query pipeline has no handle method', async () => {
    const scope = makeScope({ [TOKENS.QUERY_PIPELINES_BEHAVIOR]: {} })
    const mediator = new Mediator(makeAccessor(scope))
    const result = await mediator.query(makeQuery(), makeSignal())
    expect(result.isOk()).toBe(false)
    expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.PIPELINE_NOT_AVAILABLE)
  })

  it('returns handler result on happy path', async () => {
    const intent = 'TestQuery'
    const handler = makeHandler(Result.ok<TestResponse>({ value: 'query-ok' }))
    const pipeline = makePipeline((_req, next) => next())
    const scope = makeScope({
      [TOKENS.QUERY_PIPELINES_BEHAVIOR]: pipeline,
      [intent]: handler,
    })
    const mediator = new Mediator(makeAccessor(scope))
    const result = await mediator.query(makeQuery(intent), makeSignal())
    expect(result.isOk()).toBe(true)
  })

  it('throws AppError when handler is not found for query', async () => {
    const intent = 'MissingQueryHandler'
    const pipeline = makePipeline((_req, next) => next())
    const scope = makeScope({
      [TOKENS.QUERY_PIPELINES_BEHAVIOR]: pipeline,
      [intent]: undefined,
    })
    const mediator = new Mediator(makeAccessor(scope))
    await expect(mediator.query(makeQuery(intent), makeSignal())).rejects.toBeInstanceOf(AppError)
  })
})

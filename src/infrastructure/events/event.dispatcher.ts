import type { IEventDispatcher, IEventHandler, Optional, ResultType } from '@xeno-js/shared'
import { AppError, Guards, Result } from '@xeno-js/shared'

export class EventDispatcher implements IEventDispatcher {
  private readonly _handlers = new Map<string, IEventHandler<unknown>[]>()

  public subscribe<TEvent>(eventType: string, handler: IEventHandler<TEvent>): void {
    const handlers = this._handlers.get(eventType) ?? []
    handlers.push(handler)
    this._handlers.set(eventType, handlers)
  }

  public async publish<TEvent extends { eventType: string }>(
    event: TEvent,
    signal?: Optional<AbortSignal>,
  ): Promise<ResultType<void>> {
    AppError.throwIfAborted(signal, 'EventDispatcher.publish')

    const handlers = this._handlers.get(event.eventType)
    if (Guards.isNullOrEmpty(handlers)) return Result.ok()

    try {
      for (const handler of handlers) {
        const result = await handler.handle(event, signal)
        if (!result.isOk()) {
          return Result.fail(result.getErrorOrThrow())
        }
      }
      return Result.ok()
    } catch (error) {
      return Result.fail(AppError.internalServerError('EventDispatcher', error))
    }
  }
}

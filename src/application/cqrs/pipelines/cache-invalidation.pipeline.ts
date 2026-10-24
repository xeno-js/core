import type {
  Delegate,
  ICache,
  ICommand,
  ILogger,
  IPipelineBehavior,
  ResultType,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

export class CommandCacheInvalidationBehavior<
  TInput extends ICommand<TResult>,
  TResult,
> implements IPipelineBehavior<TInput, TResult> {
  constructor(
    private readonly _cacheService: ICache,
    private readonly _logger: ILogger,
  ) {}

  public async handle(request: TInput, next: Delegate<TResult>): Promise<ResultType<TResult>> {
    const result = await next()

    if (result.isOk() && Guards.isDefined(request.cacheInvalidation)) {
      try {
        const { keys, patterns } = request.cacheInvalidation

        if (Guards.isArray(keys)) {
          for (const key of keys) {
            await this._cacheService.remove(key)
            this._logger.debug(`[Cache Invalidation] Removed key: ${key}`)
          }
        }

        if (Guards.isArray(patterns) && Guards.hasMethod(this._cacheService, 'removePattern')) {
          for (const pattern of patterns) {
            await this._cacheService.removePattern(pattern)
            this._logger.debug(`[Cache Invalidation] Removed pattern: ${pattern}`)
          }
        }
      } catch (error) {
        this._logger.warn(
          `[Cache Invalidation ERROR] Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return result
  }
}

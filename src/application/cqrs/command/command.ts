import type { ICommand, Optional, RequestType } from '@xeno-js/shared'
import { REQUEST_TYPE } from '@xeno-js/shared'

/**
 * @description Base class for all commands.
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export abstract class Command<TResponse = unknown> implements ICommand<TResponse> {
  public readonly type: RequestType = REQUEST_TYPE.COMMAND
  public readonly cacheInvalidation: Optional<{
    keys?: string[]
    patterns?: string[]
  }> = undefined

  constructor(
    readonly intent: string,
    cacheInvalidation?: {
      keys?: string[]
      patterns?: string[]
    },
  ) {
    this.cacheInvalidation = cacheInvalidation
  }
}

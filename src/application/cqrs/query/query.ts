import type { ICacheableOptions, IQuery, RequestType } from '@xeno-js/shared'
import { REQUEST_TYPE } from '@xeno-js/shared'

/**
 * @description Base class for all queries.
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export abstract class Query<TResponse = unknown> implements IQuery<TResponse> {
  public readonly type: RequestType = REQUEST_TYPE.QUERY

  constructor(
    readonly intent: string,
    readonly cacheOptions: ICacheableOptions,
  ) {}
}

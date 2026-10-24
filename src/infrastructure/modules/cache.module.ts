import type { CacheConfig, IModule, IServiceContainer, XenoRegistry } from '@xeno-js/shared'
import { Guards, TOKENS } from '@xeno-js/shared'

import { CacheKeyBuilder } from '../cache'
import { CacheUtils } from './utils'

/**
 * @description CacheModule is responsible for registering cache services in the IoC container. Default implementation is in-memory
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class CacheModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  CacheConfig
> {
  public async configure(
    container: IServiceContainer<TRegistry>,
    opts: CacheConfig = { inMemory: true },
  ): Promise<void> {
    container.addSingleton(
      TOKENS.CACHE_KEY_BUILDER,
      (c) => new CacheKeyBuilder(c.resolve(TOKENS.IDENTITY_ACCESSOR)),
    )

    if (opts.inMemory && Guards.isDefined(opts.provider))
      throw new Error('Cannot use both in memory and provider cache')
    else if (opts.inMemory) {
      await CacheUtils.addCache(container)
    } else if (Guards.isDefined(opts.provider)) {
      container.addSingleton(TOKENS.CACHE, (c) => opts.provider!(c))
    } else throw new Error('No cache provider specified')
  }
}

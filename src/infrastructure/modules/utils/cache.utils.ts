import type { IServiceContainer, XenoRegistry } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { InMemoryCache } from '@/infrastructure/cache'

/**
 * @description Utility functions for configuring caching in the service container.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export const CacheUtils = Object.freeze({
  /**
   * @description Checks if the provided cache configuration requires any cache strategies.
   * @param container The service container to which the cache strategies will be added.
   * @param opts The cache configuration options.
   * @returns True if any cache strategies are required, false otherwise.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  async addCache<TRegistry extends XenoRegistry = XenoRegistry>(
    container: IServiceContainer<TRegistry>,
  ): Promise<void> {
    container.addSingleton(TOKENS.CACHE, () => new InMemoryCache())
  },
} as const)

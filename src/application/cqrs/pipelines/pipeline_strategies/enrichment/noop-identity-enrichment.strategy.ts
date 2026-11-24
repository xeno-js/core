import type { Identity, IStrategy, ResultType } from '@xeno-js/shared'
import { Result } from '@xeno-js/shared'

/**
 * @description Default identity enrichment strategy. Leaves the identity unchanged.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class NoopIdentityEnrichmentStrategy implements IStrategy<Identity> {
  public async execute(_identity: Identity): Promise<ResultType<void>> {
    return Result.ok()
  }
}

import type { Optional, RequestContext } from '@xeno-js/shared'
import type { IRateLimitKeyBuilder, IRequestContext, XenoRegistry } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description The RateLimitKeyBuilder class implements the IRateLimitKeyBuilder interface, providing a method to build rate limit keys based on the user's identity. This class utilizes an instance of IIdentityAccessor to retrieve the current user's identity, allowing for the creation of tenant-specific rate limit keys in multi-tenant applications. If a tenant ID is present in the identity, the rate limit key is prefixed with the tenant ID; otherwise, it defaults to a public rate limit key. This approach ensures that rate limit data is appropriately scoped to the user's context, preventing data leakage between tenants.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-vue
 * @copyright Xeno
 * @license MIT
 */
export class RateLimitKeyBuilder implements IRateLimitKeyBuilder {
  constructor(
    private readonly _contextAccessor: IRequestContext<RequestContext, XenoRegistry<unknown>>,
  ) {}

  public buildRateLimitKey(resource: string): Optional<string> {
    const ctx = this._contextAccessor.getContext()

    const tenantId = ctx?.identity?.tenantId
    const userId = ctx?.identity?.userId
    const clientIp = ctx?.network?.clientIp

    if (!Guards.isNullOrEmpty(tenantId) && !Guards.isNullOrEmpty(userId))
      return `ratelimit:tenant:${tenantId}:user:${userId}:${resource}`

    if (!Guards.isNullOrEmpty(tenantId) && !Guards.isNullOrEmpty(clientIp))
      return `ratelimit:tenant:${tenantId}:ip:${clientIp}:${resource}`

    if (!Guards.isNullOrEmpty(userId)) return `ratelimit:user:${userId}:${resource}`

    if (!Guards.isNullOrEmpty(clientIp)) return `ratelimit:ip:${clientIp}:${resource}`

    return undefined
  }
}

import type { ICacheKeyBuilder, IIdentityAccessor } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description The CacheKeyBuilder class implements the ICacheKeyBuilder interface, providing a method to build contextual cache keys based on the user's identity. This class utilizes an instance of IIdentityAccessor to retrieve the current user's identity, allowing for the creation of tenant-specific cache keys in multi-tenant applications. If a tenant ID is present in the identity, the cache key is prefixed with the tenant ID; otherwise, it defaults to a public cache key. This approach ensures that cached data is appropriately scoped to the user's context, preventing data leakage between tenants.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class CacheKeyBuilder implements ICacheKeyBuilder {
  /**
   * @description Constructs a new instance of the CacheKeyBuilder class, which requires an IIdentityAccessor to access the current user's identity. The constructor initializes the dependency needed for building contextual cache keys based on the user's identity, enabling tenant-specific caching behavior in multi-tenant applications.
   * @param _identityAccessor An instance of IIdentityAccessor used to retrieve the current user's identity, allowing for the construction of tenant-specific cache keys.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(private readonly _identityAccessor: IIdentityAccessor) {}

  public buildContextualKey(key: string): string {
    const identity = this._identityAccessor.getIdentity()

    if (Guards.isDefined(identity) && !Guards.isNullOrEmpty(identity.tenantId)) {
      return `tenant:${identity.tenantId}:${key}`
    }

    return `${key}:public`
  }

  public buildUserScopedKey(key: string): string {
    const identity = this._identityAccessor.getIdentity()

    if (Guards.isDefined(identity) && !Guards.isNullOrEmpty(identity.userId)) {
      return this.buildContextualKey(`user:${identity.userId}:${key}`)
    }

    return this.buildContextualKey(key)
  }
}

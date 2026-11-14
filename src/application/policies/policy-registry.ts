import type { IPolicyRegistry } from '@xeno-js/shared'
import type { AuthPolicy, Optional } from '@xeno-js/shared'

/**
 * @description The PolicyRegistry class is an implementation of the IPolicyRegistry interface that manages role-based access control policies. It provides methods to add policies for certain intents and to retrieve the access control policy for a given intent. The policies are stored in a cache, allowing for efficient retrieval and management of access control policies across the application.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class PolicyRegistry implements IPolicyRegistry {
  /**
   * @description Constructs a new instance of the PolicyRegistry class, which is responsible for managing role-based access control policies. It takes an ICache instance as a parameter, which is used to store and retrieve policies for specific intents. The cache allows for efficient management of access control policies across the application.
   * @param _cache An instance of ICache used to store and retrieve policies for specific intents. This cache is essential for efficient management of access control policies across the application.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  constructor(private readonly _cache: Map<string, AuthPolicy> = new Map()) {}

  public addPolicy(intent: string, policy: AuthPolicy): this {
    const key = this.getKey(intent)
    this._cache.set(key, policy)
    return this
  }

  public setSuperadminRoles(roles: string[]): this {
    const key = this.getKey('superadmin')
    this._cache.set(key, { roles })
    return this
  }

  public getPolicy(intent: string): Optional<AuthPolicy> {
    const key = this.getKey(intent)
    return this._cache.get(key)
  }

  private getKey(intent: string): string {
    return `policy:${intent.toLowerCase()}`
  }
}

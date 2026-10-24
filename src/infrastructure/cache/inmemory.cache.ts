import type { ICache, IDisposable, Optional } from '@xeno-js/shared'
import type { IAtomicCache } from '@xeno-js/shared'
import { Guards, StringHelper } from '@xeno-js/shared'

interface NodeTimeout {
  unref: () => void
}

/**
 * @description The InMemoryCacheExtended class extends the InMemoryCache class and implements the IAtomicCache interface. It provides an implementation of the increment method, which increments the value associated with the given key in the cache. If the key does not exist, it is created with an initial value of 1. The method returns a Promise that resolves to the incremented value.
 */
export class InMemoryCache implements ICache, IAtomicCache, IDisposable {
  private _cleanupInterval: ReturnType<typeof setInterval>

  /**
   * @description Constructs a new instance of the InMemoryCache class, which initializes an internal Map to store cached values. The Map is used to associate cache keys with their corresponding values and expiration times, allowing for efficient retrieval and management of cached data. The constructor does not take any parameters, as the in-memory cache is self-contained and does not require external dependencies or configuration.
   * @param _cache An optional Map instance to use as the underlying storage for the cache. If not provided, a new Map will be created to store cached values.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  constructor(
    private _cache: Map<string, { value: string; expiresAt: Optional<number> }> = new Map(),
  ) {
    this._cleanupInterval = setInterval(() => this.evictExpired(), 300_000)
    if (this._isNodeTimeout(this._cleanupInterval)) {
      this._cleanupInterval.unref()
    }
  }

  private _isNodeTimeout(timer: unknown): timer is NodeTimeout {
    return Guards.isDefined(timer) && Guards.isObject(timer) && Guards.hasMethod(timer, 'unref')
  }

  public async get<T>(key: string): Promise<Optional<T>> {
    const entry = this._cache.get(key)
    if (!Guards.isDefined(entry)) {
      return undefined
    }
    if (Guards.isDefined(entry.expiresAt) && entry.expiresAt < Date.now()) {
      this._cache.delete(key)
      return undefined
    }
    return JSON.parse(entry.value) as T
  }

  public async set<T>(key: string, value: T, ttl: Optional<number>): Promise<void> {
    const expiresAt = Guards.isDefined(ttl) ? Date.now() + ttl * 1000 : undefined
    this._cache.set(key, { value: StringHelper.safeStringify(value), expiresAt })
  }

  public async setIfAbsent<T>(key: string, value: T, ttl: Optional<number>): Promise<boolean> {
    if (this._cache.has(key)) {
      return false
    }
    await this.set(key, value, ttl)
    return true
  }

  public async remove(key: string): Promise<void> {
    this._cache.delete(key)
  }

  public async has(key: string): Promise<boolean> {
    const entry = this._cache.get(key)
    if (!Guards.isDefined(entry)) {
      return false
    }
    if (Guards.isDefined(entry.expiresAt) && entry.expiresAt < Date.now()) {
      this._cache.delete(key)
      return false
    }
    return true
  }

  public async clear(): Promise<void> {
    this._cache.clear()
  }

  public async increment(key: string, ttlSeconds: Optional<string | number>): Promise<number> {
    const entry = this._cache.get(key)
    const now = Date.now()

    if (Guards.isDefined(entry) && (!Guards.isDefined(entry.expiresAt) || entry.expiresAt > now)) {
      const nextValue = Number(StringHelper.safeParse(entry.value)) + 1
      this._cache.set(key, {
        value: StringHelper.safeStringify(nextValue),
        expiresAt: entry.expiresAt,
      })
      return nextValue
    }

    const ttl = !Guards.isNullOrEmpty(ttlSeconds) ? Number(ttlSeconds) : 60
    const expiresAt = now + ttl * 1000
    this._cache.set(key, { value: StringHelper.safeStringify(1), expiresAt })

    return 1
  }

  private evictExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this._cache.entries()) {
      if (!Guards.isDefined(entry.expiresAt) || entry.expiresAt > now) {
        this._cache.delete(key)
      }
    }
  }

  public async dispose(): Promise<void> {
    clearInterval(this._cleanupInterval)
    this._cache.clear()
  }

  public async removePattern(pattern: string): Promise<void> {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    const regexString = `^${escaped.replace(/\*/g, '.*')}$`
    const regex = new RegExp(regexString)
    for (const key of this._cache.keys()) {
      if (regex.test(key)) {
        this._cache.delete(key)
      }
    }
  }
}

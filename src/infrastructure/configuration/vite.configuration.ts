import type { Dictionary, IConfigurationService, Optional } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

declare global {
  interface ImportMeta {
    env: Dictionary
  }
}

const VITE_PREFIX = 'VITE_'

/**
 * @description Implementation of IConfigurationService for Vite/Browser environments.
 * Encapsulates environment variable reading with type-safety and default fallbacks.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class ViteConfigurationService implements IConfigurationService {
  constructor(private readonly _env: Dictionary = import.meta.env ?? {}) {}

  public get(key: string, defaultValue?: string): Optional<string> {
    const fullKey = key.startsWith(VITE_PREFIX) ? key : `VITE_${key}`
    const value = String(this._env[fullKey])

    if (!Guards.isNullOrEmpty(value)) return value

    return defaultValue
  }

  public getNumber(key: string, defaultValue?: number): Optional<number> {
    const rawValue = this.get(key)
    if (Guards.isDefined(rawValue)) {
      const parsed = Number(rawValue)
      if (!Number.isNaN(parsed)) return parsed
    }
    return defaultValue
  }

  public getBoolean(key: string, defaultValue?: boolean): Optional<boolean> {
    const rawValue = this.get(key)
    if (Guards.isDefined(rawValue)) {
      const str = String(rawValue).toLowerCase().trim()
      if (str.toLowerCase() === 'true' || str === '1') return true
      if (str.toLowerCase() === 'false' || str === '0') return false
    }
    return defaultValue
  }

  public getOrThrow(key: string): string {
    const val = this.get(key)
    if (!Guards.isDefined(val)) {
      throw new Error(`[Configuration Error]: Missing required environment variable "${key}".`)
    }
    return val
  }

  public getEnvironment(): string {
    return (this._env.MODE as string) ?? 'development'
  }
}

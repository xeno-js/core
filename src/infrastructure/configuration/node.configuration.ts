import type { IConfigurationService } from '@xeno-js/shared'
import type { Dictionary, Optional } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description
 * This class implements the IConfigurationService interface and provides methods to retrieve configuration values from environment variables.
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class EnvironmentConfigurationService implements IConfigurationService {
  /**
   * @description Internal dictionary to hold environment variables.
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  private readonly _env: Dictionary<Optional<string>>

  /**
   * @description Constructs an instance of EnvironmentConfigurationService and initializes the internal environment variable dictionary.
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor() {
    this._env = process.env
  }

  public get(key: string, defaultValue?: string): Optional<string> {
    const value = this._env[key]
    if (Guards.isNullOrEmpty(value)) {
      return defaultValue
    }
    return value
  }

  public getEnvironment(): string {
    return this._env.NODE_ENV ?? 'development'
  }

  public getNumber(key: string, defaultValue?: number): Optional<number> {
    const value = this.get(key)
    if (Guards.isNullOrEmpty(value)) {
      return defaultValue
    }
    const parsed = Number(value)
    if (isNaN(parsed)) {
      throw new Error(
        `[Configuration Error]: Key "${key}" with value "${value}" is not a valid number.`,
      )
    }
    return parsed
  }

  public getBoolean(key: string, defaultValue?: boolean): Optional<boolean> {
    const value = this.get(key)
    if (Guards.isNullOrEmpty(value)) {
      return defaultValue
    }
    const normalized = value.toLowerCase().trim()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false

    throw new Error(
      `[Configuration Error]: Key "${key}" with value "${value}" is not a valid boolean.`,
    )
  }

  public getOrThrow(key: string): string {
    const value = this.get(key)
    if (!Guards.isDefined(value)) {
      throw new Error(
        `[Configuration Error]: Required configuration key "${key}" is missing in the environment.`,
      )
    }
    return value
  }
}

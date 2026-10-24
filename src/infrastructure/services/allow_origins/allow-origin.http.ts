import type { Optional } from '@xeno-js/shared'
import type { IAllowOrigin } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description A class that implements the IAllowOrigin interface.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class AllowOrigin implements IAllowOrigin {
  constructor(private readonly _list: string[]) {}

  public isAllowed(origin: Optional<string>): boolean {
    if (Guards.isNullOrEmpty(origin)) return true

    const cleanOrigin = origin.trim().toLowerCase()

    for (const pattern of this._list) {
      const cleanPattern = pattern.trim().toLowerCase()

      if (cleanPattern === '*') return true

      if (cleanPattern === cleanOrigin) return true

      if (cleanPattern.startsWith('*.')) {
        const domainSuffix = cleanPattern.substring(1)
        if (cleanOrigin.endsWith(domainSuffix)) {
          const prefix = cleanOrigin.slice(0, cleanOrigin.length - domainSuffix.length)
          if (!Guards.isNullOrEmpty(prefix) && !prefix.includes('.')) return true
        }
      }
    }

    return false
  }
}

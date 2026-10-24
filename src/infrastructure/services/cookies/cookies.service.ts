import type { IConfigurationService, INetworkContextAccessor } from '@xeno-js/shared'
import type { ISsrCookie, ISsrCookieHandler, ISsrCookieToSet } from '@xeno-js/shared'
import { Guards, HttpHelper } from '@xeno-js/shared'

/**
 *
 */
export class CookieHandler implements ISsrCookieHandler {
  private readonly _pendingCookies: ISsrCookieToSet[] = []

  constructor(
    private readonly _contextAccessor: INetworkContextAccessor,
    private readonly _config: IConfigurationService,
    private readonly _defaultOpts?: Partial<ISsrCookieToSet>,
  ) {}

  public getAll(): ISsrCookie[] {
    const network = this._contextAccessor.getNetworkContext()
    const cookie = network?.cookies

    if (Guards.isNullOrEmpty(cookie)) return []

    const parsedCookies = HttpHelper.parseCookies(network?.cookies)

    return Object.entries(parsedCookies).map(([name, value]) => ({
      name,
      value,
    }))
  }

  public setAll(cookies: ISsrCookieToSet[]): void {
    this._pendingCookies.push(...cookies)
  }

  public getPendingCookies(): string[] {
    return this._pendingCookies.map((c) => this.serialize(c))
  }

  private serialize(cookie: ISsrCookieToSet): string {
    const safeName = encodeURIComponent(cookie.name)
    const safeValue = encodeURIComponent(cookie.value ?? '')
    let str = `${safeName}=${safeValue}`

    const isProd = this._config.get('NODE_ENV') === 'production'
    const merged: ISsrCookieToSet = {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      ...this._defaultOpts,
      ...cookie,
    }

    if (!Guards.isNullOrEmpty(merged.path)) str += `; Path=${merged.path}`

    if (!Guards.isNullOrEmpty(merged.maxAge)) str += `; Max-Age=${merged.maxAge}`

    if (!Guards.isNullOrEmpty(merged.expires)) str += `; Expires=${merged.expires.toUTCString()}`

    if (!Guards.isNullOrEmpty(merged.domain)) str += `; Domain=${merged.domain}`

    if (!Guards.isNullOrEmpty(merged.secure) && merged.secure) str += '; Secure'

    if (!Guards.isNullOrEmpty(merged.httpOnly) && merged.httpOnly) str += '; HttpOnly'

    if (!Guards.isNullOrEmpty(merged.sameSite)) {
      if (Guards.isBoolean(merged.sameSite)) {
        str += merged.sameSite ? '; SameSite=Strict' : ''
      } else {
        const val = merged.sameSite.toLowerCase()
        const formatted = val.charAt(0).toUpperCase() + val.slice(1)
        str += `; SameSite=${formatted}`
      }
    }

    if (Guards.isDefined(merged.partitioned)) str += '; Partitioned'

    if (Guards.isDefined(merged.priority)) {
      const p = merged.priority.toLowerCase()
      const formattedPriority = p.charAt(0).toUpperCase() + p.slice(1)
      str += `; Priority=${formattedPriority}`
    }

    return str
  }
}

import type {
  IContextAccessor,
  IMiddleware,
  RequestContext,
  ResponseDto,
  XenoRequest,
} from '@xeno-js/shared'
import type { ICsrfTokenService, MiddlewareConfig } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description The CsrfCookieMiddleware class implements the IMiddleware interface, providing a concrete implementation for handling CSRF token validation and cookie management. It checks the incoming request for a valid CSRF token and sets a CSRF cookie if necessary.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 * @license MIT
 */
export class CsrfCookieMiddleware implements IMiddleware {
  constructor(
    private readonly _requestContext: IContextAccessor<RequestContext>,
    private readonly _csrfTokenService: ICsrfTokenService,
    private readonly _csrf: NonNullable<MiddlewareConfig['csrf']>,
  ) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    const response = await next()

    const context = this._requestContext.getContext()
    const identity = context?.identity
    const network = context?.network

    if (!Guards.isDefined(identity?.userId)) return response

    if (Guards.isDefined(network?.csrfCookie)) return response

    const token = await this._csrfTokenService.generate(identity.userId)

    const cookieName = this._csrf.cookieName ?? '__Host-xeno-csrf'
    const maxAge = this._csrf.cookieMaxAgeSeconds ?? 3600
    const sameSite = this._csrf.sameSite ?? 'lax'

    const cookie =
      `${cookieName}=${encodeURIComponent(token)}; ` +
      `Path=/; ` +
      `Secure; ` +
      `SameSite=${sameSite}; ` +
      `Max-Age=${maxAge}`

    const existingCookies = response.headers?.['Set-Cookie']

    response.headers = {
      ...(response?.headers ?? {}),
      'Set-Cookie': [...(existingCookies ?? []), cookie],
    }

    return response
  }
}

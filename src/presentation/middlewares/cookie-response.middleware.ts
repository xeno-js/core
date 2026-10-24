import type { IMiddleware, ResponseDto, XenoRequest } from '@xeno-js/shared'
import type { IRequestContext, XenoRegistry } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

export class CookieResponseMiddleware<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IMiddleware {
  constructor(private readonly _requestContext: IRequestContext<unknown, TRegistry>) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    const response = await next()

    const scope = this._requestContext.getScope()
    if (!Guards.isDefined(scope)) {
      return response
    }

    try {
      const cookieHandler = scope.resolve(TOKENS.COOKIE_HANDLER)
      const pending = cookieHandler.getPendingCookies()

      if (!Guards.isNullOrEmpty(pending)) {
        const existingSetCookie = response.headers?.['Set-Cookie']
        const mergedCookies = Guards.isArray(existingSetCookie)
          ? [...existingSetCookie, ...pending]
          : Guards.isDefined(existingSetCookie)
            ? [String(existingSetCookie), ...pending]
            : [...pending]

        response.headers = {
          ...(response?.headers ?? {}),
          'Set-Cookie': mergedCookies,
        }
      }
    } catch {
      /* noop */
    }

    return response
  }
}

import type { IServiceExtractor, Optional } from '@xeno-js/shared'
import { Guards, HttpHelper } from '@xeno-js/shared'

/**
 * @description The BearerTokenExtractor class implements the IExtractor interface, providing a concrete implementation for extracting Bearer tokens from the Authorization header of an incoming HTTP request. The extract method checks for the presence of the Authorization header, verifies that it starts with the "Bearer " prefix, and returns the token value if valid. If the header is missing or does not conform to the expected format, it returns undefined, allowing for consistent handling of authentication tokens in the application.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class BearerTokenExtractor implements IServiceExtractor<
  Request['headers'],
  Optional<string>
> {
  constructor(private readonly _cookiePrefix: string) {}
  extract(headers: Request['headers']): Optional<string> {
    const authHeader = headers.get('Authorization')

    if (Guards.isDefined(authHeader) && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.substring(7)
    }

    const cookieHeader = headers.get('cookie')
    if (Guards.isDefined(cookieHeader)) {
      const cookies = HttpHelper.parseCookies(cookieHeader)
      const token = cookies[this._cookiePrefix]

      if (Guards.isDefined(token)) {
        return token
      }
    }

    return undefined
  }
}

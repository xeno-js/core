import { Guards, HttpHelper, type IServiceExtractor, type Optional } from '@xeno-js/shared'

/**
 * @description The HttpCookieExtractor class implements the IServiceExtractor interface, providing a concrete implementation for extracting HTTP cookie values from an incoming HttpRequest. The extract method retrieves the value of a specified cookie, handling both string and array formats for cookie values. If the cookie is not present or if the cookies object is null or empty, it returns undefined, allowing for consistent handling of missing cookies in the application.
 */
export class HttpCookieExtractor implements IServiceExtractor<
  {
    header: Optional<string>
    name: string
  },
  Optional<string>
> {
  extract(cookie: { header: Optional<string>; name: string }): Optional<string> {
    if (!Guards.isDefined(cookie.header)) return undefined

    const cookies = HttpHelper.parseCookies(cookie.header)
    return cookies[cookie.name]
  }
}

import type { IServiceExtractor } from '@xeno-js/shared'
import type { Metadata } from '@xeno-js/shared'
import { Guards, GuidHelper, HttpHelper, MathHelper, type Optional } from '@xeno-js/shared'

/**
 * @description The HttpHeaderExtractor class implements the IServiceExtractor interface, providing a concrete implementation for extracting HTTP header values from an incoming HttpRequest. The extract method retrieves the value of a specified header, handling both string and array formats for header values. If the header is not present or if the headers object is null or empty, it returns undefined, allowing for consistent handling of missing headers in the application.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class HttpHeaderExtractor implements IServiceExtractor<Request['headers'], Metadata> {
  /**
   * @description Constructor for HttpHeaderExtractor. It takes an instance of IServiceExtractor for extracting Bearer tokens, allowing for separation of concerns and adherence to the Single Responsibility Principle (SRP). This design enables the HttpHeaderExtractor to focus on general header extraction while delegating the specific logic of Bearer token extraction to a dedicated extractor, promoting code reusability and maintainability.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  constructor(
    private readonly _cookieExtractor: IServiceExtractor<
      {
        header: Optional<string>
        name: string
      },
      Optional<string>
    >,
    private readonly _trustedIp: Optional<string>,
    private readonly _cookieName: string,
    private readonly _csrfCookieHeader = 'x-csrf-token',
  ) {}

  extract(headers: Request['headers']): Metadata {
    const correlationId = GuidHelper.parse(headers.get('x-correlation-id') ?? undefined)
    const requestId = GuidHelper.parse(headers.get('x-request-id') ?? undefined)
    const clientIp =
      headers.get(this._trustedIp?.toLowerCase() ?? 'x-forwarded-for') ??
      headers.get('x-real-ip') ??
      undefined
    const spanId = GuidHelper.parse(headers.get('x-span-id') ?? undefined)
    const parentSpanId = headers.get('x-parent-span-id') ?? undefined
    const acceptHeader = headers.get('accept')
    const contentTypeHeader = headers.get('content-type')
    const userAgent = headers.get('user-agent') ?? undefined
    const returnAddress = headers.get('x-return-address') ?? undefined
    const sequenceId = headers.get('x-sequence-id') ?? undefined
    const position = headers.get('x-sequence-position')
    const size = headers.get('x-sequence-size')
    const expiration = headers.get('x-expiration')

    const csrf = headers.get(this._csrfCookieHeader) ?? undefined
    const cookieHeader = headers.get('cookie') ?? undefined
    const csrfCookie = this._cookieExtractor.extract({
      header: cookieHeader,
      name: this._cookieName,
    })
    const origin = headers.get('origin') ?? undefined
    const cleanOrigin = HttpHelper.sanitizeOriginUrl(origin)
    const referer = headers.get('referer') ?? undefined
    const cleanReferer = HttpHelper.sanitizeOriginUrl(referer)

    const accept = acceptHeader === '*/*' ? undefined : acceptHeader
    const formatIndicator = accept ?? contentTypeHeader ?? 'application/json'

    const metadata: Metadata = {
      correlationId,
      requestId,
      clientIp,
      spanId,
      parentSpanId,
      formatIndicator,
      userAgent,
      returnAddress,
      csrf,
      csrfCookie,
      cookies: cookieHeader,
      origin: cleanOrigin,
      referer: cleanReferer,
      sequence: {
        sequenceId,
        position: Guards.isDefined(position) ? MathHelper.toNumber(position) : undefined,
        size: Guards.isDefined(size) ? MathHelper.toNumber(size) : undefined,
      },
      expiration: Guards.isDefined(expiration) ? MathHelper.toNumber(expiration) : undefined,
    }

    return metadata
  }
}

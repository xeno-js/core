import type { IFactory, IHttpAdapter, XenoIncomingRequest, XenoRequest } from '@xeno-js/shared'
import { Guards, HttpHelper, HttpRouteParamHelper } from '@xeno-js/shared'

/**
 * @description Base HTTP adapter.
 * @author Xeno
 * @version 1.2.1
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class HttpAdapter implements IHttpAdapter {
  constructor(private readonly _urlFactory: IFactory<Headers, string>) {}
  /**
   * @description Creates the XenoRequest.
   * @param req The XenoIncomingRequest
   * @returns The XenoRequest.
   */
  public adapt(req: XenoIncomingRequest): XenoRequest {
    const baseUrl = this._urlFactory.create(req.headers)
    const safeUrl = HttpHelper.parseSafeUrl(req.url, baseUrl)
    const method = req.method.toUpperCase()

    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers: req.headers,
    }

    const parsedBody = HttpHelper.parseBody(method, req.body)
    if (Guards.isDefined(parsedBody)) {
      init.body = parsedBody
      init.duplex = 'half'
    }

    const xenoRequest = new Request(safeUrl.toString(), init) as XenoRequest

    xenoRequest.path = safeUrl.pathname
    xenoRequest.socket = req.socket

    xenoRequest.query = req.query ?? HttpRouteParamHelper.extractQueryParams(req.url)

    return xenoRequest
  }
}

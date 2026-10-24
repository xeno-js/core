import type {
  HttpHeaders,
  IMiddleware,
  INetworkContextAccessor,
  IRoutePolicyCheck,
  ResponseDto,
  XenoRequest,
} from '@xeno-js/shared'
import type { IAllowMethod } from '@xeno-js/shared'
import { Guards, HttpHelper, STATUS_CODES } from '@xeno-js/shared'

/**
 * @description A middleware that handles OPTIONS requests.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class OptionsMiddleware implements IMiddleware {
  constructor(
    private readonly _requestContext: INetworkContextAccessor,
    private readonly _allowMethod: IAllowMethod,
    private readonly _getRouteMatcher: () => IRoutePolicyCheck,
    private readonly _allowHeaders: string[] = [],
    private readonly _withCredentials: 'true' | 'false' = 'false',
  ) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    if (req.method.toUpperCase() === 'OPTIONS') {
      const network = this._requestContext.getNetworkContext()
      const origin = network?.origin
      const targetMethod = req.headers.get('access-control-request-method') ?? 'GET'

      const policy = this._getRouteMatcher().checkRoutePolicy(req.path, targetMethod)

      const withCredentials = Guards.isDefined(policy.withCredentials)
        ? policy.withCredentials
          ? 'true'
          : 'false'
        : this._withCredentials

      const headers: HttpHeaders = {}
      if (
        Guards.isDefined(origin) ||
        (Guards.isDefined(policy.allowOrigins) && policy.allowOrigins.includes('*'))
      ) {
        headers['Access-Control-Allow-Origin'] =
          Guards.isDefined(policy.allowOrigins) &&
          policy.allowOrigins.includes('*') &&
          withCredentials === 'false'
            ? '*'
            : origin!
        headers['Access-Control-Allow-Credentials'] = withCredentials
        headers['Vary'] = 'Origin'
      }

      headers['Access-Control-Allow-Methods'] = this._allowMethod.getMethods(req.path)
      headers['Access-Control-Allow-Headers'] = this._allowHeaders.join(', ')

      return HttpHelper.success(null as T, STATUS_CODES.NO_CONTENT, {}, headers)
    }
    return await next()
  }
}

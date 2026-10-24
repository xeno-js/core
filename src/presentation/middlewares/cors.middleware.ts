import type {
  IContextAccessor,
  IMiddleware,
  IRoutePolicyCheck,
  RequestContext,
  ResponseDto,
  XenoRequest,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description A cors middleware that checks if the origin of the request is allowed.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class CORSMiddleware implements IMiddleware {
  constructor(
    private readonly _requestContext: IContextAccessor<RequestContext>,
    private readonly _getRouteMatcher: () => IRoutePolicyCheck,
    private readonly _withCredentials: 'true' | 'false' = 'false',
  ) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    const { network } = this._requestContext.getContext() ?? {}
    const origin = network?.origin

    const response = await next()

    const policy = this._getRouteMatcher().checkRoutePolicy(req.path, req.method)
    const withCredentials = Guards.isDefined(policy.withCredentials)
      ? policy.withCredentials
        ? 'true'
        : 'false'
      : this._withCredentials

    const allowOrigins = policy.allowOrigins

    if (
      Guards.isDefined(origin) ||
      (Guards.isDefined(allowOrigins) && allowOrigins.includes('*'))
    ) {
      response.headers = {
        ...(response?.headers ?? {}),
        'Access-Control-Allow-Origin':
          Guards.isDefined(allowOrigins) &&
          allowOrigins.includes('*') &&
          withCredentials === 'false'
            ? '*'
            : origin!,
        'Access-Control-Allow-Credentials': withCredentials,
        'Vary': 'Origin',
      }
    }
    return response
  }
}

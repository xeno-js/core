import type {
  IContextAccessor,
  ILogger,
  IMiddleware,
  IRoutePolicyCheck,
  Optional,
  RequestContext,
  ResponseDto,
  RoutePolicy,
  XenoRequest,
} from '@xeno-js/shared'
import type { IAllowOrigin } from '@xeno-js/shared'
import {
  ERROR_CODE_MESSAGES,
  ERROR_CODES,
  Guards,
  GuidHelper,
  HttpHelper,
  STATUS_CODES,
} from '@xeno-js/shared'

/**
 * @description A middleware that checks if the origin of the request is allowed.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class AllowOriginMiddleware implements IMiddleware {
  constructor(
    private readonly _allowOrigin: IAllowOrigin,
    private readonly _requestContext: IContextAccessor<RequestContext>,
    private readonly _logger: ILogger,
    private readonly _getRouteMatcher: () => IRoutePolicyCheck,
  ) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    const { network, tracing } = this._requestContext.getContext() ?? {}
    const origin = network?.origin

    const policy = this._getRouteMatcher().checkRoutePolicy(req.path, req.method)

    const isAllowed = this.checkOrigin(policy, origin)

    if (!isAllowed) {
      this._logger.warn(`Access denied by AllowOrigin policy for origin: ${origin ?? 'unknown'}`)

      return HttpHelper.error(
        {
          success: false,
          error: {
            code: ERROR_CODES.FORBIDDEN,
            message: ERROR_CODE_MESSAGES[ERROR_CODES.FORBIDDEN],
            details: `The origin '${origin ?? 'unknown'}' is not allowed to access this resource.`,
            path: req.path,
          },
          correlationId: tracing?.correlationId ?? GuidHelper.generate(),
          requestId: network?.requestId ?? GuidHelper.generate(),
          spanId: tracing?.spanId ?? GuidHelper.generate(),
          timestamp: new Date().toISOString(),
        },
        STATUS_CODES.FORBIDDEN,
      )
    }

    return next()
  }

  private checkOrigin(policy: RoutePolicy, origin: Optional<string>): boolean {
    if (Guards.isDefined(policy.allowOrigins)) {
      return policy.allowOrigins.includes('*') || policy.allowOrigins.includes(origin ?? '')
    } else {
      return this._allowOrigin.isAllowed(origin)
    }
  }
}

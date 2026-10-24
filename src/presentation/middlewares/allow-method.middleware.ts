import type {
  HttpMethod,
  IMiddleware,
  RequestContext,
  ResponseDto,
  XenoRequest,
} from '@xeno-js/shared'
import type { IAllowMethod, IRequestContext, XenoRegistry } from '@xeno-js/shared'
import {
  ERROR_CODE_MESSAGES,
  ERROR_CODES,
  GuidHelper,
  HttpHelper,
  STATUS_CODES,
} from '@xeno-js/shared'

/**
 * @description Middleware that checks if the requested method is allowed for the given path. If the method is not allowed, it returns a 405
 * status code with an error message.
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 * @param {IAllowMethod} _allowMethod - The allow method service to check if the method is allowed.
 * @param {IRequestContext<RequestContext, XenoRegistry>} _requestContext - The request context to get the request context.
 * @returns {IMiddleware} - The middleware function that checks if the method is allowed.
 * @throws {Error} - If the method is not allowed, it throws an error with a 405 status code and an error message.
 * @see {@link IAllowMethod} - The allow method service.
 * @see {@link IRequestContext} - The request context.
 * @see {@link IMiddleware} - The middleware interface.
 * @see {@link IResponseDto} - The response DTO.
 */
export class MethodCheckMiddleware implements IMiddleware {
  constructor(
    private readonly _requestContext: IRequestContext<RequestContext, XenoRegistry>,
    private readonly _allowMethod: IAllowMethod,
  ) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    const isAllowed = this._allowMethod.check(req.path, req.method as HttpMethod)

    if (!isAllowed) {
      const { network, tracing } = this._requestContext.getContext() ?? {}

      return HttpHelper.error(
        {
          success: false,
          error: {
            code: ERROR_CODES.NOT_ALLOWED,
            message: ERROR_CODE_MESSAGES[ERROR_CODES.NOT_ALLOWED],
            details: `Operation blocked by allow method middleware`,
            path: req.path,
          },
          correlationId: tracing?.correlationId ?? GuidHelper.generate(),
          requestId: network?.requestId ?? GuidHelper.generate(),
          spanId: tracing?.spanId ?? GuidHelper.generate(),
          timestamp: new Date().toISOString(),
        },
        STATUS_CODES.NOT_ALLOWED,
        {
          Allow: this._allowMethod.getMethods(req.path),
        },
      )
    }

    return await next()
  }
}

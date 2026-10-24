import type {
  Identity,
  ILogger,
  IMiddleware,
  IServiceExtractor,
  RequestContext,
  XenoRequest,
} from '@xeno-js/shared'
import type { Guid, Metadata, ResponseDto } from '@xeno-js/shared'
import type { IIPResolver, IRequestContext, XenoRegistry } from '@xeno-js/shared'
import {
  ERROR_CODE_MESSAGES,
  ERROR_CODES,
  GUEST,
  GuidHelper,
  HttpHelper,
  STATUS_CODES,
} from '@xeno-js/shared'

import { ContextMapper } from '../mappers/context.mapper'

/**
 * @description The RequestContextMiddleware class is responsible for extracting metadata from incoming HTTP requests, performing authentication using the provided authentication middleware, and composing an ExecutionContext that includes identity, network, and tracing information. It implements the IMiddleware interface, allowing it to be used as part of a middleware chain in the request processing pipeline. The middleware ensures that the ExecutionContext is properly set up for downstream handlers, controllers, or use cases to access necessary contextual information for processing the request.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class RequestContextMiddleware implements IMiddleware {
  /**
   * @description Constructs a new instance of the RequestContextMiddleware class, which is responsible for handling the request context in the middleware chain. It takes several dependencies as parameters, including an IRequestContext for managing the execution context, an IServiceExtractor for extracting metadata from HTTP headers, an IGateKeeper for performing authentication, and an IServiceContainer for managing service scopes and dependencies. These dependencies are essential for the middleware to function correctly, allowing it to extract necessary information from incoming requests, authenticate users, and set up the execution context for downstream processing.
   * @param _requestContext An instance of IRequestContext used to manage the execution context for the request. This context allows the middleware to set and retrieve contextual information that can be accessed by downstream handlers, controllers, or use cases during the processing of the request.
   * @param _extractor An instance of IServiceExtractor used to extract metadata from the incoming HTTP request headers. This extractor is responsible for parsing the headers and retrieving relevant information such as correlation IDs, request IDs, authentication tokens, client IP addresses, and tracing span IDs, which are essential for building the ExecutionContext.
   * @param _logger
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    private readonly _requestContext: IRequestContext<RequestContext, XenoRegistry>,
    private readonly _extractor: IServiceExtractor<Request['headers'], Metadata>,
    private readonly _resolver: IIPResolver,
    private readonly _logger: ILogger,
  ) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    const correlationId = GuidHelper.generate()
    const requestId = GuidHelper.generate()
    const spanId: Guid = GuidHelper.generate()
    let formatIndicator = 'application/json'

    try {
      const meta = this._extractor.extract(req.headers)

      const clientIp = this._resolver.resolve(req, meta.clientIp)

      formatIndicator = meta.formatIndicator
      const metadata: Metadata = {
        ...meta,
        clientIp,
        correlationId: meta.correlationId ?? correlationId,
        requestId: meta.requestId ?? requestId,
        spanId: meta.spanId ?? spanId,
        formatIndicator,
      }

      const tmpContext = ContextMapper.map({
        metadata,
        identity: GUEST as unknown as Identity,
        path: req.path,
      })

      const result = await this._requestContext.runAsync(tmpContext, async () => {
        return next()
      })
      if (!result.ok && !result.data.success)
        this._logger.error(result.data.error.message, result.data)

      return result
    } catch (error) {
      this._logger.error('RequestContextMiddleware encountered an error', error)
      return HttpHelper.error(
        {
          success: false,
          error: {
            code: ERROR_CODES.SYSTEM_ERROR,
            message: ERROR_CODE_MESSAGES[ERROR_CODES.SYSTEM_ERROR],
            details: `[Fatal System Error] Exception caught during request handling on path: ${req.path}`,
            path: req.path,
          },
          correlationId,
          requestId,
          spanId,
          timestamp: new Date().toISOString(),
        },
        STATUS_CODES.INTERNAL_SERVER_ERROR,
        { 'Content-Type': [formatIndicator] },
      )
    }
  }
}

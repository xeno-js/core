import type {
  AppError,
  ICommand,
  IContextAccessor,
  IController,
  IMediator,
  IQuery,
  RequestContext,
  ResultType,
} from '@xeno-js/shared'
import type { Dictionary, Optional, ResponseDto } from '@xeno-js/shared'
import { GuidHelper, HttpHelper } from '@xeno-js/shared'

/**
 * BaseController is an abstract class that implements the IController interface. It provides a foundation for creating specific controllers that handle incoming requests and return responses. The class requires a mediator to facilitate communication between different parts of the application.
 * @template TRequest - The type of the request object that the controller will handle.
 * @template TResponse - The type of the response object that the controller will return.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export abstract class BaseController<TRequest, TResponse> implements IController<
  TRequest,
  TResponse
> {
  /**
   * Constructs a new instance of the BaseController class.
   * @param _requestContext - An instance of IContextAccessor used to manage the execution context for requests.
   * @param _mediator - An instance of IMediator used to facilitate communication between different parts of the application.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    private readonly _requestContext: IContextAccessor<RequestContext>,
    private readonly _mediator: IMediator,
  ) {}

  abstract handle(request: TRequest, signal: Optional<AbortSignal>): Promise<ResponseDto<TResponse>>

  /**
   * Helper to return a successful 200/201 response.
   * @param data - The data to include in the response.
   * @param status - The HTTP status code (default is 200).
   * @param meta - Optional metadata to include in the response.
   * @param headers - Optional headers to include in the response.
   * @returns A ResponseDto containing the data and status.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  protected ok<T>(
    data: T,
    status = 200,
    meta: Optional<Dictionary> = {},
    headers: Optional<Dictionary<string[]>> = {},
  ): ResponseDto<T> {
    return HttpHelper.success(data, status, meta, headers)
  }

  /**
   * Helper to automatically map a failed Result (from the CQRS pipeline)
   * into a standardized ErrorResponseDto.
   * @param error - The AppError instance representing the error.
   * @param details - Optional additional details about the error.
   * @param headers - Optional headers to include in the error response.
   * @returns A ResponseDto representing the error response.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  protected fail(
    error: AppError,
    details: Optional<string> = undefined,
    headers: Optional<Dictionary<string[]>> = {},
  ): ResponseDto<TResponse> {
    const context = this._requestContext.getContext()

    const customHeaders = error['header'] as Optional<Dictionary<string[]>>

    return HttpHelper.error<TResponse>(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          path: context?.network.path,
          details: details ?? error.message,
        },
        correlationId: context?.tracing.correlationId ?? GuidHelper.generate(),
        requestId: context?.network.requestId ?? GuidHelper.generate(),
        spanId: context?.tracing.spanId ?? GuidHelper.generate(),
        timestamp: new Date().toISOString(),
      },
      error.status,
      {
        'Content-Type': [context?.network.formatIndicator ?? 'application/json'],
        ...customHeaders,
        ...headers,
      },
    )
  }

  /**
   * Helper to send a query through the mediator and return the result.
   * @param request - The IQuery instance to be sent.
   * @param signal - The AbortSignal
   * @returns A promise resolving to the result of the query.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  protected _query(
    request: IQuery<TResponse>,
    signal: Optional<AbortSignal>,
  ): Promise<ResultType<TResponse>> {
    return this._mediator.query(request, signal)
  }

  /**
   * Helper to send a command through the mediator and return the result.
   * @param request - The ICommand instance to be sent.
   * @param signal - The AbortSignal
   * @returns A promise resolving to the result of the command.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  protected _send(
    request: ICommand<TResponse>,
    signal: Optional<AbortSignal>,
  ): Promise<ResultType<TResponse>> {
    return this._mediator.send(request, signal)
  }

  protected getContext(): Optional<RequestContext> {
    return this._requestContext.getContext()
  }
}

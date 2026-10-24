import type {
  Delegate,
  ICommand,
  IHandler,
  IMediator,
  IPipelineBehavior,
  IQuery,
  IRequest,
  Optional,
  ResultType,
} from '@xeno-js/shared'
import type { IServiceScopeAccessor, XenoRegistry } from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'
import { ERROR_CODE_MESSAGES, ERROR_CODES, Guards, STATUS_CODES } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

/**
 * @description Mediator implementation for CQRS pattern. It is responsible for sending commands and executing queries by delegating them to the appropriate handlers, while also applying any registered pipeline behaviors (middlewares).

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class Mediator<TRegistry extends XenoRegistry = XenoRegistry> implements IMediator {
  /**
   * @param _factoryScope - An instance of IServiceScopeAccessor used to access the current service scope, which is necessary for resolving handlers and pipeline behaviors for processing requests.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  constructor(private readonly _factoryScope: IServiceScopeAccessor<TRegistry>) {}

  /**
   * @inheritdoc
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  async send<TResponse>(
    request: ICommand<TResponse>,
    signal: Optional<AbortSignal>,
  ): Promise<ResultType<TResponse>> {
    return this.process<TResponse>(request, TOKENS.COMMAND_PIPELINES_BEHAVIOR, signal)
  }

  /**
   * @inheritdoc
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  async query<TResponse>(
    request: IQuery<TResponse>,
    signal: Optional<AbortSignal>,
  ): Promise<ResultType<TResponse>> {
    return this.process<TResponse>(request, TOKENS.QUERY_PIPELINES_BEHAVIOR, signal)
  }

  /**
   * @description Internal method to process both commands and queries. It resolves the appropriate handler for the request and applies the registered pipeline behaviors in the correct order.
   * @param request The command or query to be processed.
   * @param pipelineToken The token used to resolve the pipeline behaviors for the request.
   * @param signal An optional AbortSignal to allow cancellation of the request.
   * @returns A promise that resolves to the result of processing the request.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  private async process<TResponse>(
    request: IRequest<TResponse>,
    pipelineToken: keyof XenoRegistry,
    signal: Optional<AbortSignal>,
  ): Promise<ResultType<TResponse>> {
    if (Guards.isDefined(signal) && signal.aborted)
      return Result.fail(AppError.aborted(request.intent))

    const scope = this._factoryScope.getScope()

    if (!Guards.isDefined(scope))
      return Result.fail(
        AppError.create({
          code: ERROR_CODES.SCOPE_NOT_AVAILABLE,
          status: STATUS_CODES.INTERNAL_SERVER_ERROR,
          name: request.intent,
          message: ERROR_CODE_MESSAGES[ERROR_CODES.SCOPE_NOT_AVAILABLE],
          cause: new Error('Service scope is required to process the request.'),
        }),
      )

    const pipelines = scope.resolve(pipelineToken) as unknown as IPipelineBehavior<
      IRequest<TResponse>,
      TResponse
    >

    if (!Guards.isDefined(pipelines) || !Guards.hasMethod(pipelines, 'handle')) {
      return Result.fail(
        AppError.create({
          code: ERROR_CODES.PIPELINE_NOT_AVAILABLE,
          status: STATUS_CODES.INTERNAL_SERVER_ERROR,
          name: request.intent,
          message: ERROR_CODE_MESSAGES[ERROR_CODES.PIPELINE_NOT_AVAILABLE],
          cause: new Error('Pipeline behavior is required to process the request.'),
        }),
      )
    }

    const next: Delegate<TResponse> = () => {
      const handler = scope.resolve(request.intent as keyof TRegistry) as IHandler<
        IRequest<TResponse>,
        TResponse
      >

      if (!Guards.isDefined(handler) || !Guards.hasMethod(handler, 'handle')) {
        AppError.throw({
          code: ERROR_CODES.HANDLER_NOT_FOUND,
          status: STATUS_CODES.INTERNAL_SERVER_ERROR,
          name: request.intent,
          message: ERROR_CODE_MESSAGES[ERROR_CODES.HANDLER_NOT_FOUND],
          cause: new Error('Handler is required to process the request.'),
        })
      }
      return handler.handle(request, signal)
    }

    return pipelines.handle(request, next)
  }
}

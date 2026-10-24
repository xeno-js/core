import type {
  IFactory,
  IHandler,
  IRequest,
  Optional,
  ResultType,
  UserContext,
} from '@xeno-js/shared'
import { AppError } from '@xeno-js/shared'

/**
 * BaseHandler is an abstract class that implements the IHandler interface.
 * It provides a base implementation for handling requests and executing strategies.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export abstract class BaseHandler<
  TRequest extends IRequest<TResponse>,
  TResponse,
> implements IHandler<TRequest, TResponse> {
  constructor(private readonly _identityFactory: IFactory<void, UserContext>) {}

  public async handle(
    request: TRequest,
    signal: Optional<AbortSignal>,
  ): Promise<ResultType<TResponse>> {
    AppError.throwIfAborted(signal, this.constructor.name)

    return await this.executeAsync(request, signal)
  }

  /**
   * Executes the strategy for the given request.
   * @param request - The request to be handled.
   * @param signal - (Optional) The abort signal for the request.
   * @throws {AppError} If the strategy execution fails.
   * @protected - This method should be overridden by subclasses.
   * @abstract - This method must be implemented by subclasses.
   * @async - This method is asynchronous.
   * @template TRequest - The type of the request.
   * @template TResponse - The type of the response.
   * @returns {Promise<ResultType<TResponse>>} A promise that resolves to the result of the strategy execution.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  protected abstract executeAsync(
    request: TRequest,
    signal?: Optional<AbortSignal>,
  ): Promise<ResultType<TResponse>>

  /**
   * Gets the current context.
   * @returns {UserContext} The current context.
   * {@link UserContext}
   */
  protected _getCurrentContext(): UserContext {
    return this._identityFactory.create()
  }
}

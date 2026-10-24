/* eslint-disable @typescript-eslint/naming-convention */
import type { Delegate, ICommand, IPipelineBehavior, Optional, ResultType } from '@xeno-js/shared'
import type { ConcurrencyOptions } from '@xeno-js/shared'
import {
  AppError,
  DEFAULT_CONCURRENCY,
  ERROR_CODES,
  PromiseHelper,
  Result,
  STATUS_CODES,
} from '@xeno-js/shared'

/**
 * @description A pipeline behavior that implements a retry mechanism for handling concurrency conflicts in the CQRS pipelines. When a request results in a concurrency conflict error, this behavior will automatically retry the request up to a specified maximum number of attempts, with an exponential backoff strategy and added jitter to prevent thundering herd problems. If the maximum number of retry attempts is exceeded, it returns a failed Result with an AppError indicating the concurrency conflict.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class ConcurrencyRetryPipeline<
  TInput extends ICommand<TResult>,
  TResult,
> implements IPipelineBehavior<TInput, TResult> {
  private static readonly DEFAULT_MAX_RETRIES = DEFAULT_CONCURRENCY.MAX_RETRIES
  private static readonly DEFAULT_BASE_DELAY_MS = DEFAULT_CONCURRENCY.BASE_DELAY
  private static readonly DEFAULT_MAX_JITTER_MS = DEFAULT_CONCURRENCY.MAX_JITTER

  /**
   * @description Constructs a new instance of the ConcurrencyRetryBehavior class, which takes an optional maximum number of retry attempts and an optional delay configuration for the exponential backoff strategy. The delay configuration includes a base delay in milliseconds and a maximum jitter in milliseconds to be added to the base delay for each retry attempt. The constructor validates the input parameters to ensure that they are positive integers and throws an error if they are not.
   * @param _options Optional configuration options for the behavior, including the maximum number of retry attempts and the delay configuration for the exponential backoff strategy.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(private readonly _options: Optional<ConcurrencyOptions> = undefined) {}

  /**
   * @description Handles the request by implementing a retry mechanism for concurrency conflicts. It retries the request up to the maximum number of attempts with an exponential backoff strategy and added jitter. If the request succeeds or fails with an error that is not a concurrency conflict, it returns the result immediately. If the maximum number of retry attempts is exceeded due to concurrency conflicts, it returns a failed Result with an AppError indicating the concurrency conflict.
   * @param request The input request to be handled, which must extend ICommand.
   * @param next The delegate function that represents the next behavior or handler in the pipeline.
   * @returns A Promise that resolves to a ResultType containing either the successful result or a failed AppError if the maximum retry attempts are exceeded due to concurrency conflicts.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public async handle(request: TInput, next: Delegate<TResult>): Promise<ResultType<TResult>> {
    const intentConfig = this._options?.intentRegistry?.[request.intent]

    const maxRetries =
      intentConfig?.maxRetries ??
      this._options?.maxRetries ??
      ConcurrencyRetryPipeline.DEFAULT_MAX_RETRIES

    const baseDelay =
      intentConfig?.delayConfig?.baseDelayMs ??
      this._options?.delayConfig?.baseDelayMs ??
      ConcurrencyRetryPipeline.DEFAULT_BASE_DELAY_MS

    const jitter =
      intentConfig?.delayConfig?.maxJitterMs ??
      this._options?.delayConfig?.maxJitterMs ??
      ConcurrencyRetryPipeline.DEFAULT_MAX_JITTER_MS

    let attempts = 0

    while (true) {
      attempts++

      const result = await next()

      if (result.isOk() || !this.isConcurrencyError(result.getErrorOrThrow())) return result

      if (attempts >= maxRetries)
        return Result.fail(
          AppError.conflict(
            request.intent,
            `Maximum retry attempts (${maxRetries}) exceeded due to concurrency conflicts.`,
          ),
        )

      await PromiseHelper.delayWithJitter(baseDelay, jitter)
    }
  }

  /**
   * @description Checks if the given error is a concurrency conflict error.
   * @param error The error to be checked.
   * @returns A boolean indicating whether the error is a concurrency conflict error.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  private isConcurrencyError(error: AppError): boolean {
    return error.code === ERROR_CODES.CONFLICT && error.status === STATUS_CODES.CONFLICT
  }
}

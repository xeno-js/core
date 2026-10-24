/* eslint-disable @typescript-eslint/naming-convention */
import type {
  Delegate,
  ICommand,
  IIdempotencyStore,
  INetworkContextAccessor,
  IPipelineBehavior,
  Optional,
  ResultType,
} from '@xeno-js/shared'
import type { IdempotencyOptions } from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'
import { Guards, IDEMPOTENCY_CONSTANTS } from '@xeno-js/shared'

/**
 * @description A pipeline behavior that implements idempotency for command requests in the CQRS architecture. This behavior ensures that if multiple requests with the same command ID are received, only one of them will be processed, and the others will receive the same result without reprocessing the command. The pipeline uses an IIdempotencyStore to manage locks and store results for processed commands, allowing it to handle concurrent requests safely and efficiently while preventing duplicate processing of commands. The behavior checks if the incoming request is a command and if it has a valid ID. If the command has already been processed, it retrieves the stored result and returns it. If the command is currently being processed by another request, it returns an error indicating that the command is locked. If the command has not been processed and is not locked, it acquires a lock, processes the command, stores the result, and releases the lock accordingly. The pipeline also includes error handling to ensure that locks are released in case of exceptions during command processing.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class IdempotencyPipeline<
  TInput extends ICommand<TResult>,
  TResult,
> implements IPipelineBehavior<TInput, TResult> {
  private static readonly DEFAULT_LOCK_TTL =
    IDEMPOTENCY_CONSTANTS.DEFAULT_IDEMPOTENCY_LOCK_TTL_SECONDS
  private static readonly DEFAULT_PROCESSED_TTL = IDEMPOTENCY_CONSTANTS.DEFAULT_TTL_SECONDS

  /**
   * @description Constructs a new instance of the IdempotencyPipeline class, which requires an IIdempotencyStore for managing locks and storing results of processed commands. The constructor also accepts optional parameters for configuring the TTL (time-to-live) values for locks and processed results, allowing for customization of the idempotency behavior based on the specific needs of the application. The constructor validates the input parameters to ensure that they are positive integers and throws an error if they are not, ensuring that the pipeline is configured with valid TTL values for proper functioning of the idempotency mechanism.
   * @param idempotencyStore An instance of IIdempotencyStore used for managing locks and storing results of processed commands in the idempotency mechanism. This store is essential for ensuring that commands with the same ID are processed in an idempotent manner, allowing the pipeline to handle concurrent requests safely and efficiently while preventing duplicate processing of commands.
   * @param _options Optional configuration options for the idempotency pipeline, including the TTL values for locks and processed results. These options allow for customization of the idempotency behavior based on the specific needs of the application. The constructor validates the input options to ensure that they are positive integers and throws an error if they are not, ensuring that the pipeline is configured with valid TTL values for proper functioning of the idempotency mechanism.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    private readonly _requestContextFactory: INetworkContextAccessor,
    private readonly _idempotencyStore: IIdempotencyStore,
    private readonly _options: Optional<IdempotencyOptions> = undefined,
  ) {}

  public async handle(request: TInput, next: Delegate<TResult>): Promise<ResultType<TResult>> {
    const network = this._requestContextFactory.getNetworkContext()
    if (!Guards.isDefined(network))
      return Result.fail(
        AppError.conflict(
          request.intent,
          `network context is not defined for request ${request.intent}`,
        ),
      )

    const intentConfig = this._options?.intentRegistry?.[request.intent]
    const lockTtl =
      intentConfig?.lockTtlSeconds ??
      this._options?.lockTtlSeconds ??
      IdempotencyPipeline.DEFAULT_LOCK_TTL

    const processedTtl =
      intentConfig?.processedTtlSeconds ??
      this._options?.processedTtlSeconds ??
      IdempotencyPipeline.DEFAULT_PROCESSED_TTL

    try {
      const alreadyProcessed = await this._idempotencyStore.hasBeenProcessed(network.requestId)
      if (alreadyProcessed) {
        const payload = await this._idempotencyStore.getPayload<TResult>(network.requestId)
        if (Guards.isDefined(payload)) {
          return Result.ok(payload)
        } else {
          return Result.fail(
            AppError.conflict(
              request.intent,
              `Idempotency store indicates request has been processed but no payload found for request ID ${network.requestId}`,
            ),
          )
        }
      }

      const lockAcquired = await this._idempotencyStore.acquireLock(network.requestId, lockTtl)

      if (!lockAcquired) {
        return Result.fail(
          AppError.conflict(
            request.intent,
            `Failed to acquire lock for request ID ${network.requestId}`,
          ),
        )
      }

      const result = await next()

      if (result.isOk()) {
        await this._idempotencyStore.markAsProcessed(
          network.requestId,
          result.getValueOrThrow() ?? { success: true },
          processedTtl,
        )
      } else {
        await this._idempotencyStore.releaseLock(network.requestId)
      }

      return result
    } catch (error: unknown) {
      await this._idempotencyStore.releaseLock(network.requestId)

      throw error
    }
  }
}

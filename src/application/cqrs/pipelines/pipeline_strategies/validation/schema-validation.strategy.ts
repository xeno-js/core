import type { IRequest, IStrategy, IValidatorService, ResultType } from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'

/**
 * @description Strategy that validates incoming requests against predefined schemas. It implements the IStrategy interface and uses a schema registry to determine if a schema exists for the given request type. If a schema is found, it validates the request against the schema using a safe parsing method. If the validation fails, it returns a failed Result with an appropriate AppError indicating a validation error. If the validation succeeds, it returns a successful Result with a boolean value of true.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class SchemaValidationStrategy implements IStrategy<IRequest, boolean> {
  /**
   * @description Constructs a new instance of the SchemaValidationStrategy class, which takes an IValidatorService as a parameter. This service is used to check for the existence of validation schemas and to perform the actual validation of requests against those schemas. The constructor initializes the strategy with the provided validator service, allowing it to execute the validation logic when handling requests in the CQRS pipeline.
   * @param _validator An instance of IValidatorService that provides methods to check for the existence of validation schemas and to validate data against those schemas. This service is essential for performing the schema validation logic in this strategy.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(private readonly _validator: IValidatorService) {}

  public async execute(request: IRequest): Promise<ResultType<boolean>> {
    const key = request.intent
    const parseResult = await this._validator.validate(key, request)

    if (!parseResult.isOk()) {
      const validatorError = parseResult.getErrorOrThrow()
      const details =
        validatorError.cause instanceof Error
          ? validatorError.cause.message
          : validatorError.message

      return Result.fail(
        Object.assign(AppError.validationError(request.intent, `Validation failed: ${details}`), {
          validatorError,
        }),
      )
    }

    return Result.ok(true)
  }
}

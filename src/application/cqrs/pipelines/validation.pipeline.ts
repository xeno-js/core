import type { Delegate, IPipelineBehavior, IRequest, IStrategy, ResultType } from '@xeno-js/shared'
import { Result } from '@xeno-js/shared'
/**
 * @description A pipeline behavior that performs validation on the incoming request in a CQRS architecture. It checks if the request has a validate method and, if so, invokes it to perform validation. If the validation fails, it returns a failed Result containing the validation error. If the validation succeeds or if there is no validate method, it proceeds to the next behavior in the pipeline. This allows for a structured approach to ensuring that requests meet certain criteria before being processed further in the CQRS pipeline.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class ValidationPipeline<
  TInput extends IRequest<TResult>,
  TResult,
> implements IPipelineBehavior<TInput, TResult> {
  /** @description Constructs a new instance of the ValidationPipeline class, which takes an array of IStrategy instances as validators. These validators are used to perform validation checks on the incoming requests. The constructor initializes the pipeline with the provided validators, allowing it to execute the validation logic when handling requests in the CQRS pipeline.
   * @param _validators An array of IStrategy instances that represent the validation strategies to be applied to incoming requests. Each strategy should implement the isApplicable method to determine if it should be applied to a given request and the execute method to perform the actual validation logic, returning a Result indicating the success or failure of the validation.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(private readonly _validators: readonly IStrategy<TInput, boolean>[]) {}

  public async handle(request: TInput, next: Delegate<TResult>): Promise<ResultType<TResult>> {
    for (const validator of this._validators) {
      const validationResult = await validator.execute(request)
      if (!validationResult.isOk()) {
        return Result.fail(validationResult.getErrorOrThrow())
      }
    }
    return next()
  }
}

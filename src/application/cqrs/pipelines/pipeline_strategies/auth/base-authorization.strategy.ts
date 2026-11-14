import type {
  IContextAccessor,
  Identity,
  IPolicyRegistry,
  IRequest,
  IStrategy,
  RequestContext,
  ResultType,
} from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description Abstract base class for authorization strategies in the CQRS pipeline. This class implements the IStrategy interface and provides a common structure for performing authorization checks based on the identity of the authenticated user. It defines an abstract method performAuthorizationCheck that must be implemented by concrete authorization strategies to specify the logic for checking if the user has the necessary permissions to execute a given request. The execute method retrieves the user's identity from the request context and ensures that the user is authenticated before delegating to the performAuthorizationCheck method for further authorization validation. If the user is not authenticated, it returns a failed Result with an appropriate AppError indicating that authentication is required.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export abstract class BaseAuthorizationStrategy<
  TInput extends IRequest,
> implements IStrategy<TInput> {
  /**
   * @description Constructs a new instance of the BaseAuthorizationStrategy class, which serves as an abstract base for specific authorization strategies in the CQRS pipeline. It takes an IRequestContext as a parameter, which is used to retrieve the identity of the currently authenticated user during the authorization process. This context is essential for performing the authorization checks based on the user's identity when executing requests that require specific permissions.
   * @param requestContext An instance of IRequestContext used to access the identity of the currently authenticated user. This context is essential for performing the authorization checks based on the user's identity when executing requests that require specific permissions.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    protected readonly _policy: IPolicyRegistry,
    private readonly _requestContext: IContextAccessor<RequestContext>,
  ) {}

  public async execute(request: IRequest): Promise<ResultType<void>> {
    const context = this._requestContext.getContext()

    if (!Guards.isDefined(context)) {
      return Result.fail(AppError.unauthorized(request.intent, 'User is not authenticated.'))
    }

    const superadmin = this._policy.getPolicy('superadmin')
    if (!Guards.isNullOrEmpty(superadmin?.roles)) {
      const auth = context?.identity
      const roles = auth?.roles ?? []
      const hasRequiredRole = superadmin.roles?.some((role) => roles.includes(role))
      if (hasRequiredRole) return Result.ok()
    }

    return await this.performAuthorizationCheck(request, context.identity)
  }

  /**
   * @description Abstract method that must be implemented by concrete authorization strategies to perform the actual authorization check. This method is called after the user's identity has been retrieved and verified. It receives the request and the user's identity as parameters and should return a Result indicating whether the authorization check passed or failed.
   * @param request The incoming request for which the authorization check is being performed. This request contains information about the action being attempted and any relevant data needed for the authorization logic.
   * @param auth The identity of the currently authenticated user, which includes information such as the user's ID, tenant ID, and roles. This context is used to determine if the user has the necessary permissions to execute the request.
   * @returns A Result indicating the outcome of the authorization check. If the check passes, it should return a successful Result with a void value. If the check fails, it should return a failed Result with an appropriate AppError describing the reason for the failure.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  protected abstract performAuthorizationCheck(
    request: IRequest,
    auth: Identity,
  ): Promise<ResultType<void>>
}

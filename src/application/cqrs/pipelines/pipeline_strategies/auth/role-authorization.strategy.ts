import type {
  IContextAccessor,
  Identity,
  IPolicyRegistry,
  IRequest,
  RequestContext,
} from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

import { BaseAuthorizationStrategy } from './base-authorization.strategy'

/**
 * @description Authorization strategy that checks if the authenticated user has at least one of the required roles specified in the command. It extends the BaseAuthorizationStrategy and implements the performAuthorizationCheck method to verify if the user's roles match any of the required roles for the command. If the user is not authenticated or does not have the necessary roles, it returns a failed Result with an appropriate AppError.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class RoleAuthorizationStrategy extends BaseAuthorizationStrategy<IRequest> {
  /** @description Constructs a new instance of the RoleAuthorizationStrategy class, which is responsible for checking if the authenticated user has the required roles specified in the command. It takes an IRequestContext as a parameter, which is used to retrieve the identity of the currently authenticated user during the authorization process.
   * @param requestContext An instance of IRequestContext used to access the identity of the currently authenticated user. This context is essential for performing the authorization checks based on the user's roles when executing commands that require specific role-based permissions.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(policy: IPolicyRegistry, requestContext: IContextAccessor<RequestContext>) {
    super(policy, requestContext)
  }

  protected async performAuthorizationCheck(
    command: IRequest,
    auth: Identity,
  ): Promise<Result<void, AppError>> {
    const policy = this._policy.getPolicy(command.intent)

    if (!Guards.isNullOrEmpty(policy?.roles)) {
      const roles = auth.roles ?? []
      const hasRequiredRole = policy.roles?.some((role) => roles.includes(role))
      if (!hasRequiredRole)
        return Result.fail(
          AppError.forbidden(command.intent, 'User does not have the required roles.'),
        )
    }

    return Result.ok()
  }
}

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
 * @description Authorization strategy that checks if the authenticated user has at least one of the required permissions specified in the command. It extends the BaseAuthorizationStrategy and implements the performAuthorizationCheck method to verify if the user's permissions match any of the required permissions for the command. If the user is not authenticated or does not have the necessary permissions, it returns a failed Result with an appropriate AppError.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class PermissionAuthorizationStrategy extends BaseAuthorizationStrategy<IRequest> {
  /** @description Constructs a new instance of the PermissionAuthorizationStrategy class, which is responsible for checking if the authenticated user has the required permissions specified in the command. It takes an IRequestContext as a parameter, which is used to retrieve the identity of the currently authenticated user during the authorization process.
   * @param _policy An instance of IPolicyRegistry used to retrieve the authorization policy associated with the command's intent. This policy contains the required permissions that the user must have to execute the command.
   * @param requestContext An instance of IRequestContext used to access the identity of the currently authenticated user. This context is essential for performing the authorization checks based on the user's permissions when executing commands that require specific permission-based access.
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

    if (!Guards.isNullOrEmpty(policy?.permissions)) {
      const permissions = auth.permissions ?? []
      const hasRequiredPermission = policy.permissions?.some((permission) =>
        permissions.includes(permission),
      )
      if (!hasRequiredPermission)
        return Result.fail(
          AppError.forbidden(command.intent, 'User does not have the required permissions.'),
        )
    }

    return Result.ok()
  }
}

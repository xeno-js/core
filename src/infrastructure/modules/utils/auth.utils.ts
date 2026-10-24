import { Guards, type IPipelineBehavior, type IRequest, type IStrategy } from '@xeno-js/shared'
import {
  type AuthorizationOptions,
  type IServiceContainer,
  TOKENS,
  type XenoRegistry,
} from '@xeno-js/shared'

import {
  AuthorizationPipeline,
  PermissionAuthorizationStrategy,
  PolicyRegistry,
  RoleAuthorizationStrategy,
  TenantAuthorizationStrategy,
  UserAuthorizationStrategy,
} from '@/application'

/**
 *  @description Utility functions for configuring authentication and authorization in the service container.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export const AuthUtils = Object.freeze({
  /**
   * @description Checks if the provided authorization configuration requires any authorization strategies.
   * @param authorizationConfig The authorization configuration to check.
   * @returns True if any authorization strategies are required, false otherwise.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  async addAuthZ<TRegistry extends XenoRegistry = XenoRegistry>(
    container: IServiceContainer<TRegistry>,
    opts: AuthorizationOptions<TRegistry>,
  ): Promise<IPipelineBehavior<IRequest<unknown>, unknown>> {
    const strategies: IStrategy<IRequest>[] = []

    if (Guards.isDefined(opts.policies)) {
      const policyRegistry = opts.policies
      const registryInstance = new PolicyRegistry()
      const ctxAccessor = container.resolve(TOKENS.CONTEXT_ACCESSOR)
      const Policies = new Set<string>()

      for (const [intent, policy] of Object.entries(policyRegistry)) {
        const intentLower = intent.toLowerCase()
        registryInstance.addPolicy(intentLower, policy)

        if (!Guards.isNullOrEmpty(policy.roles)) {
          Policies.add('roles')
        }

        if (!Guards.isNullOrEmpty(policy.permissions)) {
          Policies.add('permissions')
        }

        if (!Guards.isNullOrEmpty(policy.userId)) {
          Policies.add('userId')
        }

        if (!Guards.isNullOrEmpty(policy.tenantId)) {
          Policies.add('tenantId')
        }
      }

      if (Policies.has('roles')) {
        strategies.push(new RoleAuthorizationStrategy(registryInstance, ctxAccessor))
      }

      if (Policies.has('permissions')) {
        strategies.push(new PermissionAuthorizationStrategy(registryInstance, ctxAccessor))
      }

      if (Policies.has('userId')) {
        strategies.push(new UserAuthorizationStrategy(registryInstance, ctxAccessor))
      }

      if (Policies.has('tenantId')) {
        strategies.push(new TenantAuthorizationStrategy(registryInstance, ctxAccessor))
      }
    }

    if (!Guards.isNullOrEmpty(opts.customAuthorizationStrategy)) {
      const customStrategies = opts.customAuthorizationStrategy
      customStrategies.forEach((strategyToken) => {
        if (Guards.isDefined(strategyToken)) {
          strategies.push(strategyToken(container))
        }
      })
    }

    return new AuthorizationPipeline(strategies)
  },
} as const)

import type { ICommand, IQuery } from '@xeno-js/shared'
import type {
  IAppBuilder,
  IModule,
  IServiceContainer,
  IServiceScopeAccessor,
  IXenoApplication,
  PipelinePlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards, LOG_LEVEL } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import {
  CompositePipeline,
  ExceptionPipeline,
  IdempotencyPipeline,
  LoggingPipeline,
  Mediator,
  QueryCachingPipeline,
} from '@/application'
import { CommandCacheInvalidationBehavior } from '@/application/cqrs/pipelines/cache-invalidation.pipeline'

import { IdempotencyStore } from '../idempotency'
import { PipelineSetupContext } from '../pipeline_setup'
import { CacheModule } from './cache.module'
import { AuthUtils, LoggerUtils } from './utils'

/**
 * @description CqrsModule is responsible for configuring and registering the necessary services and dependencies related to the Command Query Responsibility Segregation (CQRS) pattern in the application. It sets up the Mediator service, which acts as a central hub for handling commands and queries, allowing for a clean separation of concerns between the command and query sides of the application. By registering the Mediator in the dependency injection container, it enables other parts of the application to easily resolve and utilize its functionality for processing commands and queries.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class CqrsModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  {
    plugins: PipelinePlugin<TRegistry>[]
    builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>
  }
> {
  public async configure(
    container: IServiceContainer<TRegistry>,
    opts: {
      plugins: PipelinePlugin<TRegistry>[]
      builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>
    },
  ): Promise<void> {
    if (!container.isRegistered(TOKENS.LOGGER))
      await LoggerUtils.addLogger(container, { level: LOG_LEVEL.INFO, console: true })

    const logger = container.resolve(TOKENS.LOGGER)

    if (!container.isRegistered(TOKENS.MEDIATOR)) {
      container.addSingleton(TOKENS.MEDIATOR, (c) => {
        const serviceScopeAccessor = c.resolve(TOKENS.SERVICE_SCOPE_ACCESSOR)
        return new Mediator<TRegistry>(serviceScopeAccessor as IServiceScopeAccessor<TRegistry>)
      })
    }

    const context = new PipelineSetupContext()

    context.addCommon(new ExceptionPipeline(), 0)
    context.addCommon(new LoggingPipeline(logger), 10)

    for (const plugin of opts.plugins)
      await plugin(opts.builder, container.resolve(TOKENS.CONFIGURATION_SERVICE), context)

    if (Guards.isDefined(context.authzOpts)) {
      const authzPipeline = await AuthUtils.addAuthZ(container, context.authzOpts)
      context.addCommon(authzPipeline, 40)
    }

    if (
      (Guards.isDefined(context.idempotencyOpts) || context.isQueryCaching) &&
      !container.isRegistered(TOKENS.CACHE)
    ) {
      await new CacheModule().configure(container)
    }

    if (Guards.isDefined(context.idempotencyOpts)) {
      const store = new IdempotencyStore(
        container.resolve(TOKENS.CACHE),
        container.resolve(TOKENS.CACHE_KEY_BUILDER),
      )
      const networkCtxAccessor = container.resolve(TOKENS.NETWORK_CONTEXT_ACCESSOR)
      context.addCommand(
        new IdempotencyPipeline(networkCtxAccessor, store, context.idempotencyOpts),
        30,
      )
    }

    const sortedCommandBehaviors = context.getSortedCommandBehaviors()
    const sortedQueryBehaviors = context.getSortedQueryBehaviors()

    if (context.isQueryCaching) {
      sortedCommandBehaviors.push(
        new CommandCacheInvalidationBehavior(
          container.resolve(TOKENS.CACHE),
          container.resolve(TOKENS.LOGGER),
        ),
      )

      sortedQueryBehaviors.push(
        new QueryCachingPipeline(
          container.resolve(TOKENS.CACHE),
          container.resolve(TOKENS.CACHE_KEY_BUILDER),
          container.resolve(TOKENS.LOGGER),
        ),
      )
    }

    container.addSingleton(
      TOKENS.COMMAND_PIPELINES_BEHAVIOR,
      () => new CompositePipeline<ICommand<unknown>, unknown>(sortedCommandBehaviors),
    )

    container.addSingleton(
      TOKENS.QUERY_PIPELINES_BEHAVIOR,
      () => new CompositePipeline<IQuery<unknown>, unknown>(sortedQueryBehaviors),
    )
  }
}

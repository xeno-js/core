import type { Identity, RequestContext, ResponseDto, XenoRequest } from '@xeno-js/shared'
import type {
  IModule,
  IRequestContext,
  IServiceContainer,
  NativeRouteDefinition,
  XenoRegistry,
} from '@xeno-js/shared'
import { GUEST, GuidHelper } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { RouteMatcherFactory } from '../factories/route-matcher.factory'
import { HttpDispatcher } from '../http/dispatcher.http'

/**
 * @description RouteModule is responsible for registering routes services in the IoC container.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class RouteModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  NativeRouteDefinition<TRegistry>[]
> {
  public async configure(
    container: IServiceContainer<TRegistry>,
    opts: NativeRouteDefinition<TRegistry>[],
  ): Promise<void> {
    container.addSingleton(TOKENS.ROUTE_MATCHER, () =>
      new RouteMatcherFactory().create<TRegistry>(opts),
    )

    if (!container.isRegistered(TOKENS.MIDDLEWARE)) {
      const requestContext = container.resolve(TOKENS.REQUEST_CONTEXT)
      container.addSingleton(TOKENS.MIDDLEWARE, () => ({
        execute: async <T>(
          req: XenoRequest,
          next: () => Promise<ResponseDto<T>>,
        ): Promise<ResponseDto<T>> => {
          const syntheticContext: RequestContext = {
            identity: GUEST as unknown as Identity,
            network: {
              requestId: GuidHelper.generate(),
              clientIp: '127.0.0.1',
              path: req.path,
              formatIndicator: 'application/json',
            },
            tracing: {
              correlationId: GuidHelper.generate(),
              startTime: Date.now(),
              spanId: GuidHelper.generate(),
            },
          }
          return await requestContext.runAsync(syntheticContext, next)
        },
      }))
    }

    if (!container.isRegistered(TOKENS.HTTP_DISPATCHER)) {
      container.addSingleton(
        TOKENS.HTTP_DISPATCHER,
        (c) =>
          new HttpDispatcher<TRegistry>(
            c.resolve(TOKENS.REQUEST_CONTEXT) as IRequestContext<RequestContext, TRegistry>,
            c.resolve(TOKENS.MIDDLEWARE),
            c.resolve(TOKENS.SERVICE_PROXY),
          ),
      )
    }
  }
}

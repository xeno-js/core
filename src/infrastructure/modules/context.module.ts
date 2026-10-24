import type {
  IModule,
  IRequestContext,
  IServiceContainer,
  Optional,
  RequestContext,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards, TOKENS } from '@xeno-js/shared'

import { EventDispatcher } from '../events'
import { ServiceScopeFactory, UserContextFactory } from '../factories'
import { HttpAdapter } from '../http'
import { UrlBuilder } from '../http/url-builder.http'
import { CreateServicesProxy } from '../services/service_proxy/services.proxy'

/**
 * @description ContextModule is responsible for configuring and registering the necessary services and dependencies related to the request context in the application. It sets up the RequestContext service, which provides a way to manage and access contextual information related to a specific request or operation. By registering the RequestContext in the dependency injection container, it enables other parts of the application to easily resolve and utilize its functionality for managing request-specific data and state.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class ContextModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  Optional<IRequestContext<RequestContext, TRegistry>>
> {
  async configure(
    container: IServiceContainer<TRegistry>,
    opts?: IRequestContext<RequestContext, TRegistry>,
  ): Promise<void> {
    const requestContext = await this._getRequestContext(container, opts)

    container.addSingleton(TOKENS.REQUEST_CONTEXT, () => requestContext)
    container.addSingleton(TOKENS.CONTEXT_ACCESSOR, () => requestContext)
    container.addSingleton(TOKENS.IDENTITY_ACCESSOR, () => requestContext)
    container.addSingleton(TOKENS.SERVICE_SCOPE_ACCESSOR, () => requestContext)
    container.addSingleton(TOKENS.NETWORK_CONTEXT_ACCESSOR, () => requestContext)
    container.addSingleton(TOKENS.TRACING_CONTEXT_ACCESSOR, () => requestContext)

    container.addSingleton(TOKENS.USER_CONTEXT_FACTORY, () => {
      return new UserContextFactory(requestContext)
    })

    const serviceProxy = new CreateServicesProxy()
    container.addSingleton(TOKENS.SERVICE_PROXY, () => serviceProxy)

    container.addSingleton(TOKENS.HTTP_ADAPTER, () => new HttpAdapter(new UrlBuilder()))

    container.addSingleton(TOKENS.EVENT_DISPATCHER, () => new EventDispatcher())
  }

  private async _getRequestContext(
    container: IServiceContainer<TRegistry>,
    opts?: IRequestContext<RequestContext, TRegistry>,
  ) {
    if (Guards.isDefined(opts)) return opts

    const { NodeRequestContextFactory } = await import('../factories/request-context.factory')
    return new NodeRequestContextFactory<TRegistry>(
      new ServiceScopeFactory<TRegistry>(container),
    ).create()
  }
}

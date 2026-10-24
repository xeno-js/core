import type { IModule, IServiceContainer, XenoRegistry } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { RouteMatcherFactory } from '../factories/route-matcher.factory'
import { ServerOptionsFactory } from '../factories/server-options.factory'

export class HttpServerModule<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IModule<TRegistry> {
  async configure(container: IServiceContainer<TRegistry>): Promise<void> {
    container.addSingleton(
      TOKENS.SERVER_OPTIONS_FACTORY,
      (c) => new ServerOptionsFactory(c.resolve(TOKENS.CONFIGURATION_SERVICE)),
    )

    if (!container.isRegistered(TOKENS.ROUTE_MATCHER)) {
      container.addSingleton(TOKENS.ROUTE_MATCHER, () => new RouteMatcherFactory().create([]))
    }
  }
}

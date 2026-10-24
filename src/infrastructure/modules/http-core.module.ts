import type {
  HttpCoreConfig,
  IModule,
  IServiceContainer,
  IServiceScope,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards, type IServiceResilience, type Optional } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { RemoteDataSource } from '../datasources'
import { HttpClientFactory } from '../factories/http.factory'
import { NoOpResilienceService } from '../services/resiliences'

/**
 * @description HttpCoreModule is responsible for configuring the core HTTP functionalities of the application. It implements the IModule interface, allowing it to be integrated into the application's dependency injection system. The configure method registers essential services such as the HTTP client and resilience features based on the provided configuration options. This design promotes modularity and allows for easy management of HTTP-related operations throughout the application.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class HttpCoreModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  HttpCoreConfig<TRegistry>
> {
  public async configure(
    container: IServiceContainer<TRegistry>,
    opts: HttpCoreConfig<TRegistry>,
  ): Promise<void> {
    const factory = new HttpClientFactory()

    for (const entry of opts.clients) {
      const clientName = entry.name ?? 'default'
      const resilience = this.getResilienceService(container, entry.resilience)
      const dataSource = new RemoteDataSource(entry.client(container), resilience)
      factory.add(clientName, dataSource)
    }

    container.addSingleton(TOKENS.HTTP_CLIENT_FACTORY, () => factory)
  }

  private getResilienceService(
    container: IServiceContainer<TRegistry>,
    resilience?: Optional<(scope: IServiceScope<TRegistry>) => IServiceResilience>,
  ) {
    if (!Guards.isDefined(resilience)) {
      return new NoOpResilienceService()
    } else {
      return resilience(container)
    }
  }
}

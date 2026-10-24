import type {
  HttpConfig,
  HttpPlugin,
  IAppBuilder,
  IXenoApplication,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards, type IConfigurationService } from '@xeno-js/shared'

import { HttpCoreModule } from '../modules/http-core.module'
import { definePlugin } from './define.plugin'

/**
 * @description Generic plugin to register any custom authentication implementation into Xeno.JS.
 * It delegates the registration to the Core AuthModule.
 *
 * @param configurator Either the AuthModuleOptions object or a factory receiving the configuration service.
 * @returns A XenoPlugin ready to be passed to builder.addAuth(...)
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export const withCustomHttp = <TRegistry extends XenoRegistry = XenoRegistry>(
  config: HttpConfig<TRegistry>,
): HttpPlugin<TRegistry> => {
  return definePlugin(
    'http',
    (
      builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      _config: IConfigurationService,
    ) => {
      const clientEntries = Guards.isArray(config.clients) ? config.clients : [config.clients]

      const entries = clientEntries.map((item) => {
        if (!Guards.isDefined(item.client)) {
          throw new Error(
            `[withCustomHttp Error]: 'client' instance is required for registration '${item.name ?? 'default'}'.`,
          )
        }

        return {
          name: item.name ?? 'default',
          client: item.client,
          resilience: item.resilience,
        }
      })

      builder.addModule('HttpCoreModule', async () => new HttpCoreModule<TRegistry>(), {
        clients: entries,
      })
    },
  )
}

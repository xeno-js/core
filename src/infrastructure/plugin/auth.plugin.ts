import type { IConfigurationService, SetupAction } from '@xeno-js/shared'
import type {
  AuthModuleOptions,
  AuthPlugin,
  IAppBuilder,
  IXenoApplication,
  XenoRegistry,
} from '@xeno-js/shared'

import { AuthModule } from '../modules/auth.module'
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
export const withAuth = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup: SetupAction<AuthModuleOptions<TRegistry>, IConfigurationService>,
): AuthPlugin<TRegistry> => {
  return definePlugin(
    'auth',
    (
      builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
    ) => {
      const options = {} as AuthModuleOptions<TRegistry>
      setup(options, config)
      builder.addModule('AuthModule', async () => new AuthModule<TRegistry>(), options, 2)
    },
  )
}

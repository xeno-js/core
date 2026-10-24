// ==========================================
// 3. AUTHORIZATION (AuthZ)
// ==========================================

import type { IConfigurationService, Optional, SetupAction } from '@xeno-js/shared'
import type {
  AuthorizationOptions,
  IAppBuilder,
  IPipelineSetup,
  IXenoApplication,
  PipelinePlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

import { definePlugin } from './define.plugin'

export const withAuthZ = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup: SetupAction<AuthorizationOptions<TRegistry>, IConfigurationService>,
): PipelinePlugin<TRegistry> => {
  return definePlugin(
    'pipeline',
    (
      _builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
      context: Optional<IPipelineSetup<TRegistry>>,
    ) => {
      if (!Guards.isDefined(context)) throw new Error('Pipeline setup is not available.')

      const options: AuthorizationOptions<TRegistry> = {
        policies: undefined,
      }
      setup(options, config)

      context.authzOpts = options
    },
  )
}

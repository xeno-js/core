// ==========================================
// 7. QUERY CACHING
import type { IConfigurationService, Optional } from '@xeno-js/shared'
import type {
  IAppBuilder,
  IPipelineSetup,
  IXenoApplication,
  PipelinePlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

import { definePlugin } from './define.plugin'

// ==========================================
export const withQueryCaching = <
  TRegistry extends XenoRegistry = XenoRegistry,
>(): PipelinePlugin<TRegistry> => {
  return definePlugin(
    'pipeline',
    (
      _builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      _config: IConfigurationService,
      context: Optional<IPipelineSetup<TRegistry>>,
    ) => {
      if (!Guards.isDefined(context)) throw new Error('Pipeline setup is not available.')

      context.addQuery()
    },
  )
}

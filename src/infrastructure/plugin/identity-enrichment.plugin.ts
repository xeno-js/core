import type {
  IAppBuilder,
  IdentityEnrichmentOptions,
  IPipelineSetup,
  IXenoApplication,
  PipelinePlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import {
  Guards,
  type IConfigurationService,
  type Optional,
  type SetupAction,
} from '@xeno-js/shared'

import { definePlugin } from './define.plugin'

// ==========================================
// 5. IDENTITY ENRICHMENT
// ==========================================
export const withEnrichmentIdentity = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup?: SetupAction<IdentityEnrichmentOptions, IConfigurationService>,
): PipelinePlugin<TRegistry> => {
  return definePlugin(
    'pipeline',
    (
      _builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
      context: Optional<IPipelineSetup<TRegistry>>,
    ) => {
      if (!Guards.isDefined(context)) throw new Error('Pipeline setup is not available.')

      const options: IdentityEnrichmentOptions = {}
      if (Guards.isDefined(setup)) setup(options, config)

      context.identityEnrichmentOpts = options
    },
  )
}

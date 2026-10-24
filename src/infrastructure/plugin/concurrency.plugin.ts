// ==========================================
// 5. CONCURRENCY RETRY (PER-INTENT)
// ==========================================
import type {
  ConcurrencyOptions,
  IAppBuilder,
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

import { ConcurrencyRetryPipeline } from '@/application'

import { definePlugin } from './define.plugin'

export const withConcurrency = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup?: SetupAction<ConcurrencyOptions, IConfigurationService>,
): PipelinePlugin<TRegistry> => {
  return definePlugin(
    'pipeline',
    (
      _builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
      context: Optional<IPipelineSetup<TRegistry>>,
    ) => {
      if (!Guards.isDefined(context)) throw new Error('Pipeline setup is not available.')
      const options: ConcurrencyOptions = {}
      if (Guards.isDefined(setup)) setup(options, config)
      context.addCommand(new ConcurrencyRetryPipeline(options), 70)
    },
  )
}

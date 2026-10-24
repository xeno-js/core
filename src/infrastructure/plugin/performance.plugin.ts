import type {
  IAppBuilder,
  IPipelineSetup,
  IXenoApplication,
  PerformanceOptions,
  PipelinePlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import {
  Guards,
  type IConfigurationService,
  type Optional,
  type SetupAction,
} from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { PerformancePipeline } from '@/application'

import { definePlugin } from './define.plugin'

// ==========================================
// 6. PERFORMANCE (PER-INTENT)
// ==========================================
export const withPerformance = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup?: SetupAction<PerformanceOptions, IConfigurationService>,
): PipelinePlugin<TRegistry> => {
  return definePlugin(
    'pipeline',
    (
      builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
      context: Optional<IPipelineSetup<TRegistry>>,
    ) => {
      if (!Guards.isDefined(context)) throw new Error('Pipeline setup is not available.')

      const options: PerformanceOptions = {}
      if (Guards.isDefined(setup)) setup(options, config)

      const logger = builder.resolve(TOKENS.LOGGER)
      context.addCommon(
        new PerformancePipeline(logger, options?.intentThresholdMs, options?.thresholdMs ?? 500),
        20,
      )
    },
  )
}

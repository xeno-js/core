import type {
  IAppBuilder,
  IPipelineSetup,
  IXenoApplication,
  PipelinePlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import {
  Guards,
  type IConfigurationService,
  type IRequest,
  type IStrategy,
  type Optional,
  type SetupAction,
} from '@xeno-js/shared'

import { ValidationPipeline } from '@/application'

import { definePlugin } from './define.plugin'

// ==========================================
// 2. CUSTOM VALIDATION
// ==========================================
export const withValidation = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup: SetupAction<IStrategy<IRequest, boolean>[], IConfigurationService>,
): PipelinePlugin<TRegistry> => {
  return definePlugin(
    'pipeline',
    (
      _builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
      context: Optional<IPipelineSetup<TRegistry>>,
    ) => {
      if (!Guards.isDefined(context)) throw new Error('Pipeline setup is not available.')

      const strategies: IStrategy<IRequest, boolean>[] = []
      setup(strategies, config)

      if (Guards.isNullOrEmpty(strategies)) return
      const validationPipeline = new ValidationPipeline(strategies)
      context.addCommon(validationPipeline, 50)
    },
  )
}

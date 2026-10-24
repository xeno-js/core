import type {
  IAppBuilder,
  IdempotencyOptions,
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
// 4. IDEMPOTENCY (PER-INTENT)
// ==========================================
export const withIdempotency = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup?: SetupAction<IdempotencyOptions, IConfigurationService>,
): PipelinePlugin<TRegistry> => {
  return definePlugin(
    'pipeline',
    (
      _builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
      context: Optional<IPipelineSetup<TRegistry>>,
    ) => {
      if (!Guards.isDefined(context)) throw new Error('Pipeline setup is not available.')

      const options: IdempotencyOptions = {}
      if (Guards.isDefined(setup)) setup(options, config)

      context.idempotencyOpts = options
    },
  )
}

import type { IConfigurationService, LogLevel, SetupAction } from '@xeno-js/shared'
import type {
  IAppBuilder,
  ILoggerSetup,
  IXenoApplication,
  LoggerPlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards, LOG_LEVEL } from '@xeno-js/shared'

import { definePlugin } from './define.plugin'

interface ConsoleOptions {
  isEnabled?: boolean
  level?: LogLevel
}

/**
 * @description Plugin for configuring the logger in the application.
 *
 * @param builder - The application builder instance.
 * @param config - The configuration service instance.
 * @returns void
 *
 * @author Xeno
 */
export const withConsoleLogger = <TRegistry extends XenoRegistry = XenoRegistry>(
  setup: SetupAction<ConsoleOptions, IConfigurationService>,
): LoggerPlugin<TRegistry> => {
  return definePlugin(
    'logger',
    (
      _builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
      config: IConfigurationService,
      ctx?: ILoggerSetup<TRegistry>,
    ) => {
      if (!Guards.isDefined(ctx)) throw new Error('LoggerSetup is not defined.')
      const options: ConsoleOptions = {
        isEnabled: true,
        level: LOG_LEVEL.DEBUG,
      }
      setup(options, config)

      ctx.addConsole(options.isEnabled ?? true, options.level)
    },
  )
}

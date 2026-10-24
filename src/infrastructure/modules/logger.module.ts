import type { IConfigurationService } from '@xeno-js/shared'
import type {
  IAppBuilder,
  IModule,
  IServiceContainer,
  IXenoApplication,
  LoggerConfig,
  LoggerPlugin,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

import { LoggerSetupContext } from '../loggers/setup.logger'
import { LoggerUtils } from './utils'

/**
 * @description CacheModule is responsible for registering cache services in the IoC container. Default implementation is in-memory
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class LoggerModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  LoggerConfig<TRegistry> & { plugins?: LoggerPlugin<TRegistry>[] }
> {
  public async configure(
    container: IServiceContainer<TRegistry>,
    opts: LoggerConfig<TRegistry> & {
      builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>
      config: IConfigurationService
      plugins?: LoggerPlugin<TRegistry>[]
    },
  ): Promise<void> {
    const loggerSetup = new LoggerSetupContext<TRegistry>()
    loggerSetup.addConsole(opts.console, opts.level)
    if (!Guards.isNullOrEmpty(opts.plugins))
      opts.plugins.forEach((plugin) => plugin(opts.builder, opts.config, loggerSetup))

    if (!Guards.isNullOrEmpty(opts.customLoggers)) {
      for (const logger of opts.customLoggers) {
        loggerSetup.addCustomLogger((c) => logger(c))
      }
    }

    const options = {
      level: loggerSetup.level,
      console: loggerSetup.console,
      customLoggers: loggerSetup.getCustomLoggers(),
    }

    await LoggerUtils.addLogger(container, options)
  }
}

import type { ILoggerClient } from '@xeno-js/shared'
import type { IServiceContainer, LoggerConfig, XenoRegistry } from '@xeno-js/shared'
import { Guards, LOG_LEVEL } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { BaseLogger } from '@/application'
import { ConsoleLogger } from '@/infrastructure/loggers'

/**
 * @description LoggerUtils is a utility object that provides helper functions for the CoreModule. It includes the addLogger function, which is responsible for configuring and registering the logging services in the dependency injection container based on the provided LoggerConfig options. This function dynamically imports the necessary logger implementations (e.g., ConsoleLogger, SentryLogger, PinoLogger) and registers them with the container, allowing for flexible and modular logging configuration in the application.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export const LoggerUtils = Object.freeze({
  /**
   * @description Configures and registers the logging services in the dependency injection container based on the provided LoggerConfig options. It dynamically imports the necessary logger implementations (e.g., ConsoleLogger, SentryLogger, PinoLogger) and registers them with the container, allowing for flexible and modular logging configuration in the application.
   *
   * @param container - The service container to register logging services with.
   * @param opts - The LoggerConfig options to determine which loggers to enable and their configurations.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  async addLogger<TRegistry extends XenoRegistry = XenoRegistry>(
    container: IServiceContainer<TRegistry>,
    opts: LoggerConfig<TRegistry>,
  ): Promise<void> {
    const loggerDependencies: ILoggerClient[] = []

    if (opts.console) loggerDependencies.push(new ConsoleLogger(opts?.level))

    if (!Guards.isNullOrEmpty(opts.customLoggers)) {
      const customLoggers = opts.customLoggers
      for (const logger of customLoggers) {
        loggerDependencies.push(logger(container))
      }
    }

    container.addSingleton(TOKENS.LOGGER, (c) => {
      const context = c.resolve(TOKENS.CONTEXT_ACCESSOR)
      return new BaseLogger(context, opts?.level ?? LOG_LEVEL.DEBUG, loggerDependencies)
    })
  },
} as const)

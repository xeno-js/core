import type { IContextAccessor, ILogger, ILoggerClient, RequestContext } from '@xeno-js/shared'
import type { LogLevel, Optional } from '@xeno-js/shared'
import { LOG_LEVEL, LOG_LEVEL_NAMES } from '@xeno-js/shared'

import { LoggerUtils } from './utils'

/**
 * @description Concrete implementation of the ILogger interface that serves as a central logging service within the application. This class is designed to broadcast log messages to multiple logging clients (implementations of ILoggerClient) that are injected via the constructor. The BaseLogger class provides methods for logging messages at different levels (info, warn, debug, error) and ensures that only messages that meet or exceed the specified minimum log level are forwarded to the registered logging clients. This design allows for flexibility in logging, enabling the use of various logging providers (e.g., Sentry, Pino) without coupling the application code to specific logging frameworks.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class BaseLogger implements ILogger {
  // ─── Private Fields ─────────────────────────────────────────────────────────
  private readonly _minLevel: LogLevel
  private readonly _loggers: ILoggerClient[]

  /**
   * @description Constructs a new instance of the BaseLogger class, which takes an array of ILoggerClient instances and an optional minimum log level. The ILoggerClient instances represent the various logging providers that will receive log messages from this logger. The minimum log level determines the threshold for logging messages, where messages with a log level below the specified minimum will not be forwarded to the logging clients. This allows for efficient logging by filtering out less critical log messages based on the configured log level.
   * @param _requestContext The request context that provides contextual information for log messages, such as request-specific data or metadata.
   * @param config The minimum log level for this logger instance. Only messages with a log level equal to or higher than this level will be processed and forwarded to the logging clients.
   * @param loggers An array of ILoggerClient instances that will receive log messages from this logger. Each ILoggerClient represents a different logging provider or destination (e.g., console, file, external service).
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    private readonly _requestContext: IContextAccessor<RequestContext>,
    config: LogLevel,
    loggers: ILoggerClient[],
  ) {
    this._minLevel = config
    this._loggers = loggers
  }

  public info(message: string): void {
    this.broadcast(LOG_LEVEL.INFO, message)
  }

  public warn(message: string): void {
    this.broadcast(LOG_LEVEL.WARN, message)
  }

  public debug(message: string): void {
    this.broadcast(LOG_LEVEL.DEBUG, message)
  }

  public error(message: string, error: unknown): void {
    this.broadcast(LOG_LEVEL.ERROR, message, error)
  }

  /**
   * @description Private method to broadcast log messages to all registered ILoggerClient instances. This method checks if the log level of the message meets or exceeds the configured minimum log level before forwarding the message to the logging clients. It iterates through the array of ILoggerClient instances and calls their track method with the appropriate parameters (log level, message, context, and error if applicable). This design allows for efficient logging by ensuring that only relevant log messages are processed and forwarded to the logging clients based on the configured log level.
   * @param level The log level of the message.
   * @param message The log message.
   * @param context Optional context information to include with the log message.
   * @param error Optional error object to include with the log message.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  private broadcast(level: LogLevel, message: string, error: Optional<unknown> = undefined): void {
    if (level < this._minLevel) return

    const logMessage = `[${LOG_LEVEL_NAMES[level]}] ${message}`
    const context = this._requestContext.getContext()
    const safeContext = LoggerUtils.toSafeContext(context)
    for (const logger of this._loggers) {
      logger.track(level, logMessage, safeContext, error)
    }
  }
}

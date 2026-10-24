import type { ILoggerClient, LogLevel } from '@xeno-js/shared'
import type { ILoggerSetup, IServiceScope, XenoRegistry } from '@xeno-js/shared'
import { Guards, LOG_LEVEL } from '@xeno-js/shared'

export class LoggerSetupContext<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements ILoggerSetup<TRegistry> {
  public console = false
  public level: LogLevel = LOG_LEVEL.DEBUG
  private readonly _customLoggers: ((container: IServiceScope<TRegistry>) => ILoggerClient)[] = []

  public addConsole(enabled = true, level?: LogLevel): void {
    this.console = enabled
    if (Guards.isDefined(level)) {
      this.level = level
    }
  }

  public addCustomLogger(factory: (container: IServiceScope<TRegistry>) => ILoggerClient): void {
    this._customLoggers.push(factory)
  }

  public getCustomLoggers(): ((container: IServiceScope<TRegistry>) => ILoggerClient)[] {
    return [...this._customLoggers]
  }
}

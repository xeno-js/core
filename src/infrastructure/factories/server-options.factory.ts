import type { IConfigurationService } from '@xeno-js/shared'
import type { IServerOptionsFactory, NativeListenOptions } from '@xeno-js/shared'

export class ServerOptionsFactory implements IServerOptionsFactory {
  constructor(private readonly _config: IConfigurationService) {}

  public create(options?: NativeListenOptions): NativeListenOptions {
    const defaultPort = this._config.getNumber('PORT', 3000) ?? 3000
    const defaultHost = this._config.get('HOST', '0.0.0.0') ?? '0.0.0.0'

    return {
      port: options?.port ?? defaultPort,
      host: options?.host ?? defaultHost,
      onListening: options?.onListening,
    }
  }
}

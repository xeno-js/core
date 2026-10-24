import type { IHttpClientFactory } from '@xeno-js/shared'
import { AppError, Guards, type IRemoteDataSource } from '@xeno-js/shared'

export class HttpClientFactory implements IHttpClientFactory {
  private readonly _clients = new Map<string, IRemoteDataSource>()

  public add(name: string, client: IRemoteDataSource): void {
    if (this._clients.has(name)) {
      throw new Error(`[HttpClientFactory Error]: Client '${name}' already registered.`)
    }
    this._clients.set(name, client)
  }

  public get(name = 'default'): IRemoteDataSource {
    const client = this._clients.get(name)
    if (!Guards.isDefined(client)) {
      const available = Array.from(this._clients.keys()).join(', ') ?? 'none'
      throw AppError.notFound(
        'HttpClientFactory',
        `[HttpClientFactory Error]: Client '${name}' not found. Available clients: [${available}].`,
      )
    }
    return client
  }
}

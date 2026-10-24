import type {
  HttpBaseRequest,
  HttpMethod,
  HttpRequest,
  IHttpClient,
  IRemoteDataSource,
  IServiceResilience,
  Optional,
  ResultType,
} from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'

/**
 * @description Concrete implementation of the IRemoteDataSource contract that utilizes an agnostic HTTP client and a resilience service to fetch data from remote endpoints. The RemoteDataSource class is responsible for sending HTTP requests based on the provided HttpClientRequest parameters, while leveraging the resilience features of the IServiceResilience to ensure reliable communication with external services. This implementation abstracts away the details of how HTTP requests are made and how resilience is handled, allowing for flexibility in choosing different HTTP clients and resilience strategies without affecting the consumers of the IRemoteDataSource interface.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class RemoteDataSource implements IRemoteDataSource {
  /** The constructor of the RemoteDataSource class takes two dependencies: an instance of an agnostic HTTP client that implements the IHttpClient interface, and an instance of a resilience service that implements the IServiceResilience interface.
   * These dependencies are injected into the class, allowing for greater flexibility and testability.
   * The HTTP client is used to send requests to remote endpoints, while the resilience service is used to execute these requests with built-in support for retries, timeouts, and circuit breakers, ensuring that the remote calls are more resilient to failures and can recover gracefully from errors.
   * @param _httpClient An instance of an agnostic HTTP client that implements the IHttpClient interface, used for sending HTTP requests to remote endpoints.
   * @param _resilienceService An instance of a resilience service that implements the IServiceResilience interface, used for executing HTTP requests with built-in support for retries, timeouts, and circuit breakers to enhance the reliability of remote calls.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    private readonly _httpClient: IHttpClient,
    private readonly _resilienceService: IServiceResilience,
  ) {}

  /** @description Private method that sends an HTTP request to a specified endpoint using the provided HttpRequest options. The method utilizes the resilience service to execute the request, ensuring that it is performed with built-in support for retries, timeouts, and circuit breakers. The response from the HTTP client is then wrapped in a ResultType, which encapsulates either the successful response data or an error, providing a consistent way to handle both success and failure cases.
   * @param endpoint The URL or endpoint to which the HTTP request is sent.
   * @param options The HttpRequest options that specify the HTTP method, headers, query parameters, body, and other request configurations.
   * @returns A Promise that resolves to a ResultType containing either the successful response data or an error if the request fails.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  private async send<TResponse, TBody = unknown>(
    endpoint: string,
    options: HttpRequest<TBody>,
  ): Promise<ResultType<TResponse>> {
    const response = await this._resilienceService.execute(async () => {
      switch (options.method) {
        case 'GET':
          return await this._httpClient.get<TResponse>(endpoint, options)
        case 'POST':
          return await this._httpClient.post<TResponse, TBody>(endpoint, options.body, options)
        case 'PUT':
          return await this._httpClient.put<TResponse, TBody>(endpoint, options.body, options)
        case 'PATCH':
          return await this._httpClient.patch<TResponse, TBody>(endpoint, options.body, options)
        case 'DELETE':
          return await this._httpClient.delete<TResponse>(endpoint, options)
        default:
          throw AppError.notSupported(
            this.constructor.name,
            `Unsupported HTTP method: ${options.method}`,
          )
      }
    }, options.signal)

    return Result.ok(response.data)
  }

  protected setOptions<T>(
    request: Optional<HttpBaseRequest>,
    method: HttpMethod,
    body: Optional<T> = undefined,
  ): HttpRequest<T> {
    return {
      query: request?.query,
      signal: request?.signal,
      timeoutMs: request?.timeoutMs,
      headers: request?.headers,
      responseType: request?.responseType,
      method,
      body,
    }
  }

  public async get<TResponse>(
    endpoint: string,
    request?: HttpBaseRequest,
  ): Promise<ResultType<TResponse>> {
    const options = this.setOptions(request, 'GET')

    return await this.send<TResponse>(endpoint, options)
  }

  public async post<TResponse, TBody = unknown>(
    endpoint: string,
    body: TBody,
    request?: HttpBaseRequest,
  ): Promise<ResultType<TResponse>> {
    const options = this.setOptions(request, 'POST', body)

    return await this.send<TResponse, TBody>(endpoint, options)
  }

  public async put<TResponse, TBody = unknown>(
    endpoint: string,
    body: TBody,
    request?: HttpBaseRequest,
  ): Promise<ResultType<TResponse>> {
    const options = this.setOptions(request, 'PUT', body)

    return await this.send<TResponse, TBody>(endpoint, options)
  }

  public async patch<TResponse, TBody = unknown>(
    endpoint: string,
    body: TBody,
    request?: HttpBaseRequest,
  ): Promise<ResultType<TResponse>> {
    const options = this.setOptions(request, 'PATCH', body)

    return await this.send<TResponse, TBody>(endpoint, options)
  }

  public async delete<TResponse>(
    endpoint: string,
    request?: HttpBaseRequest,
  ): Promise<ResultType<TResponse>> {
    const options = this.setOptions(request, 'DELETE')

    return await this.send<TResponse>(endpoint, options)
  }
}

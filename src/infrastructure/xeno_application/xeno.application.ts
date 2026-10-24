import type {
  Identity,
  Optional,
  RequestContext,
  ResponseDto,
  XenoIncomingRequest,
} from '@xeno-js/shared'
import type {
  IHttpDispatcher,
  IRequestContext,
  IServiceContainer,
  IXenoApplication,
  NativeListenOptions,
  ServicesProxy,
  XenoRegistry,
} from '@xeno-js/shared'
import { AppError, Guards, GUEST, GuidHelper } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

export class XenoApplication<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IXenoApplication<TRegistry> {
  constructor(protected readonly _container: IServiceContainer<TRegistry>) {}

  /**
   * @description Resolve the services proxy
   * @returns The services proxy
   */
  public getServices(): ServicesProxy<TRegistry> {
    const container = this._container
    return new Proxy({} as ServicesProxy<TRegistry>, {
      get(_target, prop: string | symbol) {
        return container.resolve(prop as keyof TRegistry)
      },
    })
  }

  /**
   * @description Resolve the services proxy for the current request scope.
   * @returns {ServicesProxy<TRegistry>} The services proxy.
   */
  public getScopedServices(): ServicesProxy<TRegistry> {
    const serviceProxy = this._container.resolve(TOKENS.SERVICE_PROXY)
    const requestContext = this._container.resolve(TOKENS.REQUEST_CONTEXT) as IRequestContext<
      RequestContext,
      TRegistry
    >
    const scope = requestContext.getScope()
    if (!Guards.isDefined(scope)) {
      throw AppError.notFound(
        '[XenoApplication Error]',
        'Active scope not found.\n' +
          'Please use the "runInScope" or "handle" method for tasks outside the HTTP transport.',
      )
    }
    return serviceProxy.getServiceProxy<TRegistry>(scope)
  }

  /**
   * @description Run the given operation in a new scope.
   * @param {Function} operation The operation to run.
   * @param {Partial<RequestContext>} [ctx] The request context.
   * @returns {Promise<T>} The result of the operation.
   */
  public async runInScope<T>(
    operation: (services: ServicesProxy<TRegistry>) => Promise<T>,
    ctx: Optional<Partial<RequestContext>> = undefined,
  ): Promise<T> {
    const requestContext = this._container.resolve(TOKENS.REQUEST_CONTEXT) as IRequestContext<
      RequestContext,
      TRegistry
    >

    const syntheticContext: RequestContext = {
      identity: ctx?.identity ?? (GUEST as unknown as Identity),
      network: ctx?.network ?? {
        requestId: GuidHelper.generate(),
        clientIp: '127.0.0.1',
        path: 'internal://scope-runner',
        formatIndicator: 'application/json',
      },
      tracing: ctx?.tracing ?? {
        correlationId: GuidHelper.generate(),
        startTime: Date.now(),
        spanId: GuidHelper.generate(),
      },
      messaging: ctx?.messaging,
    }

    return await requestContext.runAsync(syntheticContext, async () => {
      const scope = requestContext.getScope()!
      const serviceProxy = this._container.resolve(TOKENS.SERVICE_PROXY)
      const services = serviceProxy.getServiceProxy<TRegistry>(scope)
      return await operation(services)
    })
  }

  /**
   * @description Runs a controller operation in the context of a request.
   * Use it only if middlewares are registered in the container.
   * @param req The XenoIncomingRequest request object.
   * @param token The token of the controller operation to run.
   * @param input The input to the controller operation.
   * @returns A promise that resolves to the output of the controller operation.
   */
  public async handle<TInput, TOutput, K extends keyof TRegistry>(
    req: XenoIncomingRequest,
    token: K,
    input?: Optional<TInput>,
  ): Promise<ResponseDto<TOutput>> {
    const dispatcher = this._container.resolve(TOKENS.HTTP_DISPATCHER) as IHttpDispatcher<TRegistry>
    const adapter = this._container.resolve(TOKENS.HTTP_ADAPTER)
    const extendedRequest = adapter.adapt(req)
    return await dispatcher.handle(extendedRequest, token, input)
  }

  /**
   * @description Resolves the HTTP server and starts listening on the specified port.
   * @param options The options for the HTTP server.
   * @returns A promise that resolves to the result of the HTTP server listen method.
   */
  public async listen(options?: NativeListenOptions): Promise<unknown> {
    const server = this._container.resolve(TOKENS.HTTP_SERVER)
    const opts = this._container.resolve(TOKENS.SERVER_OPTIONS_FACTORY).create(options)
    return await server.listen(opts)
  }
}

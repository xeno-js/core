import type {
  IController,
  IMiddleware,
  Optional,
  RequestContext,
  ResponseDto,
  XenoRequest,
} from '@xeno-js/shared'
import type { IHttpDispatcher, IRequestContext, IServiceProxy, XenoRegistry } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

export class HttpDispatcher<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IHttpDispatcher<TRegistry> {
  constructor(
    private readonly _requestContext: IRequestContext<RequestContext, TRegistry>,
    private readonly _middleware: IMiddleware,
    private readonly _serviceProxy: IServiceProxy,
  ) {}

  public async handle<TInput, TOutput, K extends keyof TRegistry>(
    req: XenoRequest,
    token: K,
    input?: Optional<TInput>,
  ): Promise<ResponseDto<TOutput>> {
    return await this._middleware.execute(req, async () => {
      const scope = this._requestContext.getScope()

      if (!Guards.isDefined(scope)) {
        throw new Error(
          '[HttpDispatcher Error]: Active scope not found. Execution outside RequestContext.',
        )
      }

      const services = this._serviceProxy.getServiceProxy<TRegistry>(scope)
      const controller = services[token] as Optional<IController<Optional<TInput>, TOutput>>

      if (!Guards.isDefined(controller) || !Guards.hasMethod(controller, 'handle')) {
        throw new Error(
          `[HttpDispatcher Error]: The provided '${String(token)}' does not implement the 'handle' method.`,
        )
      }

      return await controller.handle(input, req.signal)
    })
  }
}

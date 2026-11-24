import type {
  Delegate,
  Identity,
  IPipelineBehavior,
  IRequest,
  IRequestContext,
  IStrategy,
  RequestContext,
  ResultType,
} from '@xeno-js/shared'

/**
 * @description Pipeline behavior that runs the identity enrichment strategy selected for the request intent (or the global one, or a noop) before the next behavior is invoked.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class IdentityEnrichmentPipeline implements IPipelineBehavior<IRequest<unknown>, unknown> {
  constructor(
    private readonly _requestContext: IRequestContext<RequestContext>,
    private readonly _strategy: IStrategy<Identity>,
  ) {}

  public async handle(
    request: IRequest<unknown>,
    next: Delegate<unknown>,
  ): Promise<ResultType<unknown>> {
    const identity: Identity = this._requestContext.getIdentity() ?? {}
    await this._strategy.execute(identity)
    return next()
  }
}

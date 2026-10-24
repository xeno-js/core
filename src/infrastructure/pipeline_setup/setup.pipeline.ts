import type {
  AuthorizationOptions,
  IdempotencyOptions,
  IPipelineSetup,
  XenoRegistry,
} from '@xeno-js/shared'
import {
  Guards,
  type ICommand,
  type IPipelineBehavior,
  type IQuery,
  type IRequest,
  type Optional,
} from '@xeno-js/shared'

interface QueuedBehavior<T> {
  readonly order: number
  readonly behavior: T
}

export class PipelineSetupContext<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IPipelineSetup<TRegistry> {
  public isQueryCaching = false
  private readonly _commandBehaviors: QueuedBehavior<
    IPipelineBehavior<ICommand<unknown>, unknown>
  >[] = []
  private readonly _queryBehaviors: QueuedBehavior<IPipelineBehavior<IQuery<unknown>, unknown>>[] =
    []
  private _authzOpts: Optional<AuthorizationOptions<TRegistry>> = undefined
  private _idempotencyOpts: Optional<IdempotencyOptions> = undefined

  public set idempotencyOpts(opts: IdempotencyOptions) {
    this._idempotencyOpts = opts
  }

  public get idempotencyOpts(): Optional<IdempotencyOptions> {
    if (Guards.isDefined(this._idempotencyOpts)) return Object.freeze(this._idempotencyOpts)
    return this._idempotencyOpts
  }

  public set authzOpts(opts: AuthorizationOptions<TRegistry>) {
    this._authzOpts = opts
  }

  public get authzOpts(): Optional<AuthorizationOptions<TRegistry>> {
    if (Guards.isDefined(this._authzOpts)) return Object.freeze(this._authzOpts)
    return this._authzOpts
  }

  public addCommon(behavior: IPipelineBehavior<IRequest<unknown>, unknown>, order = 50): this {
    this._commandBehaviors.push({ order, behavior })
    this._queryBehaviors.push({ order, behavior })
    return this
  }

  public addCommand(behavior: IPipelineBehavior<ICommand<unknown>, unknown>, order = 50): this {
    this._commandBehaviors.push({ order, behavior })
    return this
  }

  public addQuery(): this {
    this.isQueryCaching = true
    return this
  }

  public getSortedCommandBehaviors(): IPipelineBehavior<ICommand<unknown>, unknown>[] {
    return [...this._commandBehaviors]
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.behavior)
  }

  public getSortedQueryBehaviors(): IPipelineBehavior<IQuery<unknown>, unknown>[] {
    return [...this._queryBehaviors]
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.behavior)
  }
}

import { AsyncLocalStorage } from 'node:async_hooks'

import type { IFactory, RequestContext } from '@xeno-js/shared'
import type {
  ExecutionContext,
  IRequestContext,
  IServiceScope,
  XenoRegistry,
} from '@xeno-js/shared'

import { NodeRequestContext } from '../context/request-context'

/**
 * @description Factory class responsible for creating instances of NodeRequestContext. It implements the IFactory interface, allowing for easy integration with dependency injection systems. The factory encapsulates the creation logic for the NodeRequestContext, promoting separation of concerns and flexibility in managing request context instances across the application.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class NodeRequestContextFactory<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IFactory<void, IRequestContext<RequestContext, TRegistry>> {
  private _store: AsyncLocalStorage<ExecutionContext<TRegistry>> = new AsyncLocalStorage<
    ExecutionContext<TRegistry>
  >()

  constructor(private readonly _factoryScope: IFactory<void, IServiceScope<TRegistry>>) {}

  public create(): IRequestContext<RequestContext, TRegistry> {
    return new NodeRequestContext<TRegistry>(this._store, this._factoryScope)
  }
}

import type { AsyncLocalStorage } from 'node:async_hooks'

import type {
  Identity,
  IFactory,
  NetworkContext,
  Optional,
  RequestContext,
  TracingContext,
} from '@xeno-js/shared'
import type {
  ExecutionContext,
  IRequestContext,
  IServiceScope,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description The NodeRequestContext class is an implementation of the IRequestContext interface that utilizes Node.js's AsyncLocalStorage to manage and access request-specific context data, such as user identity information, across asynchronous operations. This class provides methods to run asynchronous functions within a specific context and to retrieve the current identity information from the context when needed. By leveraging AsyncLocalStorage, the NodeRequestContext ensures that the context data is properly propagated across asynchronous calls, allowing for seamless access to identity information throughout the execution flow of a request.
 * @template TCtx - The type of the context data that will be stored and accessed using this request context implementation. This typically includes user identity information, such as user ID, roles, and correlation ID, which can be used for authentication and authorization purposes within the application.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class NodeRequestContext<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IRequestContext<RequestContext, TRegistry> {
  /**
   * @description Constructs a new instance of the NodeRequestContext class, which requires an instance of AsyncLocalStorage to manage the request context. The AsyncLocalStorage instance is used to create and access the context for each request, allowing for the storage of identity information and other relevant data that needs to be accessible across asynchronous operations. This constructor initializes the NodeRequestContext with the provided AsyncLocalStorage, enabling it to implement the methods defined in the IRequestContext interface for managing request-specific context data.
   * @param _storage An instance of AsyncLocalStorage that is used to manage the request context, allowing for the storage and retrieval of identity information and other relevant data across asynchronous operations.
   * @param _factoryScope An instance of IFactory that is used to create a new IServiceScope for managing service dependencies during the execution of the request. This allows for proper scoping and disposal of services after the request is processed, ensuring that resources are managed efficiently and preventing memory leaks.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    private readonly _storage: AsyncLocalStorage<ExecutionContext<TRegistry>>,
    private readonly _factoryScope: IFactory<void, IServiceScope<TRegistry>>,
  ) {}

  public async runAsync<T>(context: RequestContext, fn: () => Promise<T>): Promise<T> {
    const scope = this._factoryScope.create()
    try {
      return await this._storage.run({ context, scope }, fn)
    } finally {
      await scope.dispose()
    }
  }

  public updateIdentity(identity: Identity): void {
    const store = this._storage.getStore()
    if (Guards.isDefined(store) && Guards.isDefined(store.context)) {
      store.context = Object.freeze({
        ...store.context,
        identity: Object.freeze(identity),
      })
    }
  }

  public getContext(): Optional<RequestContext> {
    const store = this._storage.getStore()
    if (!Guards.isDefined(store)) return undefined
    const context = store.context
    return Object.freeze(context)
  }

  public getIdentity(): Optional<Identity> {
    const store = this._storage.getStore()
    if (!Guards.isDefined(store)) return undefined
    return Object.freeze(store.context?.identity)
  }

  public getScope(): Optional<IServiceScope<TRegistry>> {
    const store = this._storage.getStore()
    if (!Guards.isDefined(store)) return undefined
    return store.scope
  }

  public getNetworkContext(): Optional<NetworkContext> {
    const store = this._storage.getStore()
    if (!Guards.isDefined(store)) return undefined
    return Object.freeze(store.context?.network)
  }

  public getTracingContext(): Optional<TracingContext> {
    const store = this._storage.getStore()
    if (!Guards.isDefined(store)) return undefined
    return Object.freeze(store.context?.tracing)
  }
}

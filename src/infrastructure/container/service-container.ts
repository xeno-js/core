// import { AsyncLocalStorage } from 'node:async_hooks'

import type {
  Factory,
  IDisposable,
  IServiceContainer,
  IServiceScope,
  Lifetime,
  Optional,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @description Represents a registration entry in the service container, encapsulating the token, lifetime, and factory function for creating instances of the service.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
interface RegistrationEntry<T, Registry extends XenoRegistry = XenoRegistry> {
  /**
   * The unique injection token that identifies the service registration.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  token: keyof Registry
  /**
   * The lifetime of the service registration, indicating how instances are managed and reused.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  lifetime: Lifetime
  /**
   * The factory function responsible for creating instances of the service.
   * It receives the current service scope as an argument, allowing for dependency resolution within that scope.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  factory: Factory<T, [IServiceScope<Registry>]>
}

/**
 * @description Represents the context of service resolution, including the stack of tokens being resolved and the active lifetime of the current resolution.
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
interface ResolutionContext<Registry> {
  /**
   * A set of tokens currently being resolved, used to detect circular dependencies.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  stack: Set<keyof Registry>
  /**
   * The active lifetime of the current resolution, indicating whether we are constructing a singleton, scoped, or transient service.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  activeLifetime?: Lifetime
}

/**
 * @description Concrete implementation of {@link IServiceScope}, representing a logical scope for resolving scoped services within the service container.
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
class ContainerScope<
  Registry extends XenoRegistry = XenoRegistry,
> implements IServiceScope<Registry> {
  private readonly scopedInstances = new Map<keyof Registry, unknown>()
  private readonly trackedDisposables: unknown[] = []
  private isDisposed = false

  constructor(
    private readonly container: ServiceContainer<Registry>,
    private readonly parentScope?: ContainerScope<Registry>,
  ) {}

  public resolve<K extends keyof Registry>(token: K): Registry[K] {
    if (this.isDisposed) {
      throw new Error(
        `[DI Container Error]: Unable to resolve '${token as string}'. The scope has been closed.`,
      )
    }
    return this.container.internalExecuteInContext(() =>
      this.container.internalResolveInternal(token, this),
    )
  }

  public getScopedInstance<K extends keyof Registry>(token: K): Registry[K] | undefined {
    return this.scopedInstances.get(token) as Registry[K] | undefined
  }

  public setScopedInstance<K extends keyof Registry>(token: K, instance: Registry[K]): void {
    this.scopedInstances.set(token, instance)
    if (isDisposable.check(instance)) {
      this.trackedDisposables.push(instance)
    }
  }

  public trackInstance(instance: unknown): void {
    if (isDisposable.check(instance) && !this.trackedDisposables.includes(instance)) {
      this.trackedDisposables.push(instance)
    }
  }

  public async dispose(): Promise<void> {
    if (this.isDisposed) return
    this.isDisposed = true

    for (let i = this.trackedDisposables.length - 1; i >= 0; i--) {
      const disposable = this.trackedDisposables[i]
      if (isDisposable.check(disposable)) {
        try {
          await disposable.dispose()
        } catch (err) {
          console.error(`[DI Container Dispose Error]: Failed to dispose resource`, err)
        }
      }
    }

    this.scopedInstances.clear()
    this.trackedDisposables.length = 0
  }
}

/**
 * @description Concrete implementation of {@link IServiceContainer}.
 *
 * Supports three registration lifetimes:
 * - **singleton** — one shared instance per container.
 * - **transient** — a new instance on every {@link resolve} call.
 * - **scoped** — one instance per {@link IServiceScope}; must be resolved
 *   through a scope obtained via {@link createScope}.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class ServiceContainer<
  Registry extends XenoRegistry = XenoRegistry,
> implements IServiceContainer<Registry> {
  private readonly registrations = new Map<keyof Registry, RegistrationEntry<unknown, Registry>>()
  private readonly singletonInstances = new Map<keyof Registry, unknown>()
  private readonly rootScope: ContainerScope<Registry>
  private resolutionStack: Optional<ResolutionContext<Registry>> = undefined

  constructor() {
    this.rootScope = new ContainerScope<Registry>(this)
  }

  public addSingleton<K extends keyof Registry>(
    token: K,
    factory: Factory<Registry[K], [IServiceScope<Registry>]>,
  ): this {
    this.register(token, 'singleton', factory)
    return this
  }

  public addScoped<K extends keyof Registry>(
    token: K,
    factory: Factory<Registry[K], [IServiceScope<Registry>]>,
  ): this {
    this.register(token, 'scoped', factory)
    return this
  }

  public addTransient<K extends keyof Registry>(
    token: K,
    factory: Factory<Registry[K], [IServiceScope<Registry>]>,
  ): this {
    this.register(token, 'transient', factory)
    return this
  }

  private register<K extends keyof Registry>(
    token: K,
    lifetime: Lifetime,
    factory: Factory<Registry[K], [IServiceScope<Registry>]>,
  ): void {
    if (this.registrations.has(token)) {
      const tokenName = token.toString()
      throw new Error(
        `[DI Container Error]: The token '${tokenName}' is already registered in the container.`,
      )
    }
    this.registrations.set(token, { token, lifetime, factory })
  }

  public resolve<K extends keyof Registry>(token: K): Registry[K] {
    const registration = this.registrations.get(token)

    if (registration?.lifetime === 'scoped') {
      throw new Error(
        `[DI Container Error]: Scoped service '${String(token)}' requires an active scope.`,
      )
    }

    return this.internalExecuteInContext(() => this.rootScope.resolve(token))
  }

  public isRegistered<K extends keyof Registry>(token: K): boolean {
    return this.registrations.has(token)
  }

  public createScope(): IServiceScope<Registry> {
    return new ContainerScope<Registry>(this, this.rootScope)
  }

  /**
   * Executes a callback function within the context of the service container's resolution stack.
   * This method ensures that the resolution stack is properly managed, allowing for circular dependency detection and lifetime tracking during service resolution.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  internalExecuteInContext<T>(callback: () => T): T {
    if (Guards.isDefined(this.resolutionStack)) return callback()

    this.resolutionStack = {
      stack: new Set<keyof Registry>(),
    }

    try {
      return callback()
    } finally {
      this.resolutionStack = undefined
    }
  }

  /**
   * Resolve the service for the given token within the provided scope.
   * @param token The injection token to resolve.
   * @param currentScope The current service scope for resolving scoped services.
   * @returns The resolved service instance of type `T`.
   * @throws An error if no registration is found for the given token.
   * @throws An error if a circular dependency is detected.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  internalResolveInternal<K extends keyof Registry>(
    token: K,
    currentScope: ContainerScope<Registry>,
  ): Registry[K] {
    const registration = this.registrations.get(token)
    if (!Guards.isDefined(registration)) {
      const tokenName = token.toString()
      throw new Error(
        `[DI Container Error]: Registration not found for token '${tokenName}'. Ensure the service is registered before resolving.`,
      )
    }

    const currentStack = this.resolutionStack
    if (!Guards.isDefined(currentStack)) {
      throw new Error(`[DI Container Error]: Execution outside the IoC container context.`)
    }

    if (currentStack.stack.has(token)) {
      const cyclePath = [...currentStack.stack, token].map((t) => t.toString()).join(' -> ')
      const tokenName = token.toString()
      throw new Error(
        `[DI Circular Dependency Error]: Detected circular dependency while resolving '${tokenName}'. Resolution path: ${cyclePath}`,
      )
    }

    if (currentStack.activeLifetime === 'singleton' && registration.lifetime === 'scoped') {
      const captivePath = [...currentStack.stack, token].map((t) => t.toString()).join(' -> ')
      throw new Error(
        `[DI Captive Dependency Error]: Attempted to resolve a scoped service '${token.toString()}' from a singleton context. This can lead to captive dependencies. Resolution path: ${captivePath}`,
      )
    }

    const executeWithStackIsolation = (
      targetLifetime: Lifetime,
      factoryFn: () => Registry[K],
    ): Registry[K] => {
      const previousLifetime = currentStack.activeLifetime
      currentStack.stack.add(token)

      currentStack.activeLifetime =
        registration.lifetime === 'singleton' ? 'singleton' : previousLifetime
      try {
        return factoryFn()
      } finally {
        currentStack.stack.delete(token)
        currentStack.activeLifetime = previousLifetime
      }
    }

    if (registration.lifetime === 'singleton') {
      if (this.singletonInstances.has(token)) {
        return this.singletonInstances.get(token) as Registry[K]
      }

      return executeWithStackIsolation('singleton', () => {
        const instance = registration.factory(this.rootScope) as Registry[K]
        this.singletonInstances.set(token, instance)
        this.rootScope.trackInstance(instance)
        return instance
      })
    }

    if (registration.lifetime === 'scoped') {
      const existingInstance = currentScope.getScopedInstance(token)
      if (Guards.isDefined(existingInstance)) {
        return existingInstance
      }

      return executeWithStackIsolation('scoped', () => {
        const instance = registration.factory(currentScope) as Registry[K]
        currentScope.setScopedInstance(token, instance)
        return instance
      })
    }

    return executeWithStackIsolation('transient', () => {
      const instance = registration.factory(currentScope) as Registry[K]
      if (isDisposable.check(instance)) {
        currentScope.trackInstance(instance)
      }
      return instance
    })
  }

  public async dispose(): Promise<void> {
    await this.rootScope.dispose()
    this.singletonInstances.clear()
    this.registrations.clear()
  }
}

const isDisposable = Object.freeze({
  check: (obj: unknown): obj is IDisposable => {
    return (
      Guards.isDefined(obj) &&
      Guards.isObject(obj) &&
      'dispose' in obj &&
      Guards.hasMethod(obj, 'dispose')
    )
  },
} as const)

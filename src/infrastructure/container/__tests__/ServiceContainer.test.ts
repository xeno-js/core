import type { ApplicationRegistry, ITransactionalDb } from '@xeno-js/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceContainer } from '../service-container'

class Dep {}
class ServiceA {
  constructor(public readonly dep: Dep) {}
}
class ServiceB {}
class DisposableService {
  public dispose = vi.fn(async () => undefined)
}

class MySingleton {
  constructor(public readonly scopedDep: unknown) {}
}

type TestRegistry = ApplicationRegistry<ITransactionalDb> & {
  dep: Dep
  singletonA: ServiceA
  transientB: ServiceB
  scopedB: ServiceB
  disposableSingleton: DisposableService
  disposableTransient: DisposableService
  disposableScoped: DisposableService
  cycleA: { value: string }
  cycleB: { value: string }
  captiveSingleton: MySingleton
  validScoped: ServiceB
}

describe('ServiceContainer', () => {
  let container: ServiceContainer<TestRegistry>

  beforeEach(() => {
    container = new ServiceContainer<TestRegistry>()
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    await container.dispose()
  })

  describe('addSingleton', () => {
    it('registers and resolves a singleton instance', () => {
      container.addSingleton('singletonA', (scope) => new ServiceA(scope.resolve('dep')))
      container.addSingleton('dep', () => new Dep())

      const first = container.resolve('singletonA')
      const second = container.resolve('singletonA')

      expect(first).toBeInstanceOf(ServiceA)
      expect(first.dep).toBeInstanceOf(Dep)
      expect(second).toBe(first)
    })

    it('returns this for chaining', () => {
      const result = container.addSingleton('dep', () => new Dep())
      expect(result).toBe(container)
    })
  })

  describe('Circular Dependencies', () => {
    it('detects a direct circular dependency and throws an explicit error', () => {
      container.addTransient('cycleA', (scope) => {
        scope.resolve('cycleB')
        return { value: 'A' }
      })
      container.addTransient('cycleB', (scope) => {
        scope.resolve('cycleA')
        return { value: 'B' }
      })

      expect(() => container.resolve('cycleA')).toThrow(
        /\[DI Circular Dependency Error\]: Detected circular dependency while resolving/,
      )
    })

    it('isolates parallel async execution flows from sharing or polluting the resolution stack', async () => {
      container.addTransient('singletonA', (scope) => new ServiceA(scope.resolve('dep')))
      container.addTransient('dep', () => new Dep())

      const executeParallelResolutions = Promise.all([
        Promise.resolve().then(() => container.resolve('singletonA')),
        Promise.resolve().then(() => container.resolve('singletonA')),
      ])

      await expect(executeParallelResolutions).resolves.toBeDefined()

      const [res1, res2] = await executeParallelResolutions
      expect(res1).toBeInstanceOf(ServiceA)
      expect(res2).toBeInstanceOf(ServiceA)
    })
  })

  describe('Captive Dependencies', () => {
    it('throws an error when trying to inject a Scoped service inside a Singleton factory context', async () => {
      container.addScoped('validScoped', () => new ServiceB())
      container.addSingleton('captiveSingleton', (scope) => {
        const scopedInstance = scope.resolve('validScoped')
        return new MySingleton(scopedInstance)
      })

      const scope = container.createScope()

      expect(() => scope.resolve('captiveSingleton')).toThrow(
        /\[DI Captive Dependency Error\]: Attempted to resolve a scoped service 'validScoped' from a singleton context/,
      )

      await scope.dispose()
    })

    it('allows a Transient service to be resolved inside a Scoped service without throwing', async () => {
      container.addTransient('dep', () => new Dep())
      container.addScoped('scopedB', (scope) => {
        const transientDep = scope.resolve('dep')
        return new ServiceA(transientDep)
      })

      const scope = container.createScope()
      const resolved = scope.resolve('scopedB')

      expect(resolved).toBeInstanceOf(ServiceA)
      expect((resolved as ServiceA).dep).toBeInstanceOf(Dep)

      await scope.dispose()
    })
  })

  describe('isRegistered', () => {
    it('returns false when a service is not registered', () => {
      expect(container.isRegistered('dep')).toBe(false)
    })

    it('returns true when a service is registered without instantiating it', () => {
      const factorySpy = vi.fn(() => new Dep())
      container.addSingleton('dep', factorySpy)

      expect(container.isRegistered('dep')).toBe(true)
      expect(factorySpy).not.toHaveBeenCalled()
    })

    it('works for scoped and transient registrations as well', () => {
      container.addScoped('scopedB', () => new ServiceB())
      container.addTransient('transientB', () => new ServiceB())

      expect(container.isRegistered('scopedB')).toBe(true)
      expect(container.isRegistered('transientB')).toBe(true)
    })
  })

  describe('addTransient', () => {
    it('returns a new instance on each resolve', () => {
      container.addTransient('transientB', () => new ServiceB())

      const first = container.resolve('transientB')
      const second = container.resolve('transientB')

      expect(first).toBeInstanceOf(ServiceB)
      expect(second).toBeInstanceOf(ServiceB)
      expect(second).not.toBe(first)
    })

    it('returns this for chaining', () => {
      const result = container.addTransient('transientB', () => new ServiceB())
      expect(result).toBe(container)
    })

    it('tracks a reused disposable transient instance only once', async () => {
      const shared = new DisposableService()
      container.addTransient('disposableTransient', () => shared)

      container.resolve('disposableTransient')
      container.resolve('disposableTransient')

      await container.dispose()

      expect(shared.dispose).toHaveBeenCalledTimes(1)
    })
  })

  describe('addScoped', () => {
    it('creates one scoped instance per scope', () => {
      container.addScoped('scopedB', () => new ServiceB())

      const scope1 = container.createScope()
      const scope2 = container.createScope()

      const s1a = scope1.resolve('scopedB')
      const s1b = scope1.resolve('scopedB')
      const s2 = scope2.resolve('scopedB')

      expect(s1a).toBe(s1b)
      expect(s2).not.toBe(s1a)
    })

    it('returns this for chaining', () => {
      const result = container.addScoped('scopedB', () => new ServiceB())
      expect(result).toBe(container)
    })

    it('does not allow resolving scoped service from root container', () => {
      container.addScoped('scopedB', () => {
        return new ServiceB()
      })

      expect(() => {
        container.resolve('scopedB')
      }).toThrow("[DI Container Error]: Scoped service 'scopedB' requires an active scope.")
    })

    it('resolves scoped service from a created scope', () => {
      container.addScoped('scopedB', () => {
        return new ServiceB()
      })

      const scope = container.createScope()
      const instance = scope.resolve('scopedB')

      expect(instance).toBeDefined()
    })
  })

  describe('resolve', () => {
    it('throws when no registration is found for a token', () => {
      expect(() => container.resolve('transientB')).toThrow('Registration not found for token')
    })

    it('throws when registering duplicate token', () => {
      container.addSingleton('dep', () => new Dep())
      expect(() => container.addSingleton('dep', () => new Dep())).toThrow('already registered')
    })

    it('throws with cycle path when a circular dependency is detected', () => {
      container.addTransient('cycleA', (scope) => {
        scope.resolve('cycleB')
        return { value: 'a' }
      })
      container.addTransient('cycleB', (scope) => {
        scope.resolve('cycleA')
        return { value: 'b' }
      })

      expect(() => container.resolve('cycleA')).toThrow('Detected circular dependency')
      expect(() => container.resolve('cycleA')).toThrow('cycleA -> cycleB -> cycleA')
    })
  })

  describe('createScope', () => {
    it('throws when resolving from a disposed scope', async () => {
      container.addScoped('scopedB', () => new ServiceB())
      const scope = container.createScope()
      await scope.dispose()

      expect(() => scope.resolve('scopedB')).toThrow(/Scope.*closed/i)
    })
  })

  describe('dispose', () => {
    it('tracks and disposes resources sequentially', async () => {
      const singleton = new DisposableService()
      const transient = new DisposableService()
      const scoped = new DisposableService()

      container.addSingleton('disposableSingleton', () => singleton)
      container.addTransient('disposableTransient', () => transient)
      container.addScoped('disposableScoped', () => scoped)

      const scope = container.createScope()

      scope.resolve('disposableSingleton')
      scope.resolve('disposableTransient')
      scope.resolve('disposableScoped')

      await scope.dispose()
      await container.dispose()

      expect(scoped.dispose).toHaveBeenCalledTimes(1)
      expect(transient.dispose).toHaveBeenCalledTimes(1)
      expect(singleton.dispose).toHaveBeenCalledTimes(1)
    })

    it('logs and continues when a tracked disposable throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const disposeError = new Error('dispose-failure')
      const failingDisposable = {
        dispose: vi.fn(async () => {
          throw disposeError
        }),
      }

      container.addSingleton('disposableSingleton', () => failingDisposable)
      container.resolve('disposableSingleton')

      await expect(container.dispose()).resolves.toBeUndefined()
      expect(failingDisposable.dispose).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledTimes(1)
    })

    it('invalidates root scope after container disposal', async () => {
      container.addSingleton('dep', () => new Dep())

      await container.dispose()

      expect(() => container.resolve('dep')).toThrow(/Scope.*closed/i)
    })
  })
})

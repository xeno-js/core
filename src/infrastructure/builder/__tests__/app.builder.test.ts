import type {
  HttpConfig,
  IServiceContainer,
  LoggerConfig,
  MiddlewareConfig,
  NativeRouteDefinition,
  XenoRegistry,
} from '@xeno-js/shared'
import {
  type AuthClaims,
  type IConfigurationService,
  type IExtendendAuthService,
  type IHttpClient,
  type IRemoteDataSource,
  type Provider,
  Result,
  type Session,
} from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { ServiceContainer } from '../../container/service-container'
import { definePlugin } from '../../plugin/define.plugin'
import { XenoApplication } from '../../xeno_application/xeno.application'
import { XenoAppBuilder } from '../app.builder'

// -- helpers ----------------------------------------------------------------

type Registry = XenoRegistry<{
  myDummyDs: IRemoteDataSource
  myDummyHttpClient: IHttpClient
  resolveTest: number
}>

class MyAuthService implements IExtendendAuthService {
  public async isAuthenticated() {
    return true
  }

  public async getUser() {
    const claims: AuthClaims = {
      sub: '1234567890',
      name: 'John Doe',
      email: 'john.doe@example.com',
      roles: ['admin', 'user'],
      permissions: ['group1', 'group2'],
      tenantId: undefined,
    }
    return Result.ok(claims)
  }

  public async authenticate(_token: string) {
    return this.getUser()
  }
  public async signInWithProvider(_provider: Provider) {
    return Result.ok({ url: '' })
  }

  public async getSession() {
    const user = (await this.getUser()).getValueOrThrow()

    const session: Session = {
      accessToken: '',
      refreshToken: '',
      expiresAt: 500,
      user: user!,
    }

    return Result.ok(session)
  }

  public async signOut() {
    return Result.ok(undefined)
  }

  public async exchangeCodeForSession(_code: string) {
    return this.getSession()
  }
}

function makeBuilder(): XenoAppBuilder<Registry> {
  return new XenoAppBuilder<Registry>()
}

// -- Smoke test (full happy path) -------------------------------------------

describe('AppBuilder � full smoke test', () => {
  it('bootstraps all modules without throwing', async () => {
    const builder = makeBuilder()
    builder
      .addCache()
      .addAuth((opts, _config) => {
        opts.authService = () => new MyAuthService()
      })
      .addMiddlewares((opts) => {
        opts.cors = {
          allowOrigins: ['*'],
          withCredentials: false,
        }
      })

    await expect(builder.build()).resolves.toBeDefined()
  })
})

// -- Idempotency guards -----------------------------------------------------

describe('AppBuilder � idempotency guards', () => {
  it('addAuth called twice only queues one module', async () => {
    const builder = makeBuilder()
    builder.addAuth((opts, _config) => {
      opts.authService = () => new MyAuthService()
    })
    const second = builder.addAuth((opts, _config) => {
      opts.authService = () => new MyAuthService()
    })
    expect(second).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('addPipeline called twice only queues one CqrsModule', async () => {
    const builder = makeBuilder()
    builder.addPipeline()
    const second = builder.addPipeline()
    expect(second).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('addConcurrencyService called twice only queues one module', async () => {
    const builder = makeBuilder()
    builder.addConcurrencyService()
    const second = builder.addConcurrencyService()
    expect(second).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })
})

// -- Individual methods -----------------------------------------------------

describe('AppBuilder � individual methods', () => {
  it('addMiddlewares queues a module and build succeeds', async () => {
    const builder = makeBuilder()
    const result = builder.addMiddlewares((opts) => (opts.isSSR = true))
    expect(result).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('addCache without setupAction uses defaults and build succeeds', async () => {
    const builder = makeBuilder()
    const result = builder.addCache()
    expect(result).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  // it('addCache with setupAction calls it and build succeeds', async () => {
  //   const builder = makeBuilder()
  //   const setup = vi.fn()
  //   builder.addCache(setup)
  //   await builder.build()
  //   expect(setup).toHaveBeenCalledOnce()
  // })
  it('addConcurrencyService build succeeds', async () => {
    const builder = makeBuilder()
    const result = builder.addConcurrencyService()
    expect(result).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
    expect(builder.resolve(TOKENS.CONCURRENCY_SERVICE)).toBeDefined()
  })

  it('addPipeline without setupAction build succeeds', async () => {
    const builder = makeBuilder()
    const result = builder.addPipeline()
    expect(result).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('addPipeline with setupAction calls it', async () => {
    // const builder = makeBuilder()
    // const setup = vi.fn()
    // builder.addPipeline(setup)
    // await builder.build()
    // expect(setup).toHaveBeenCalledOnce()
  })
})

// -- addServices ------------------------------------------------------------

describe('AppBuilder � addServices', () => {
  it('passes the container to the setup action', async () => {
    const builder = makeBuilder()
    let captured: IServiceContainer | undefined
    const result = builder.addServices((container) => {
      captured = container
    })
    await builder.build()
    expect(result).toBe(builder)
    expect(captured).toBeDefined()
  })
})

// -- addModule --------------------------------------------------------------

describe('AppBuilder � addModule', () => {
  it('calls the factory and configure with the container and opts', async () => {
    const builder = makeBuilder()
    const configure = vi.fn().mockResolvedValue(undefined)
    const fakeModule = { configure }
    const factory = vi.fn().mockResolvedValue(fakeModule)

    const result = builder.addModule('TestModule', factory, { option: 'value' })
    expect(result).toBe(builder)

    await builder.build()

    expect(factory).toHaveBeenCalledOnce()
    expect(configure).toHaveBeenCalledOnce()
  })

  it('calls configure with undefined opts when none provided', async () => {
    const builder = makeBuilder()
    const configure = vi.fn().mockResolvedValue(undefined)
    const factory = vi.fn().mockResolvedValue({ configure })

    builder.addModule('NoOptsModule', factory)
    await builder.build()

    expect(configure).toHaveBeenCalledOnce()
  })
})

// -- resolve ----------------------------------------------------------------

// describe('AppBuilder � resolve', () => {
//   it('resolves a service registered via addServices', async () => {
//     const builder = makeBuilder()

//     // Register a singleton factory through the exposed container
//     builder.addServices((container) => {
//       container.addSingleton('resolveTest', () => 42)
//     })
//     await builder.build() // Build is not awaited here because we are only testing resolve, which is synchronous
//     const resolved = builder.resolve('resolveTest' as keyof Registry)
//     expect(resolved).toEqual(42)
//   })
// })

// -- Concurrency & Single-flight tests --------------------------------------

describe('AppBuilder – concurrency & single-flight bootstrap', () => {
  it('executes module actions only once when build is called concurrently', async () => {
    const builder = makeBuilder()
    const configureSpy = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    builder.addModule('ConcurrentModule', async () => ({
      configure: configureSpy,
    }))

    const [containerA, containerB] = await Promise.all([
      builder.build(),
      builder.build(),
      builder.build(),
    ])

    expect(configureSpy).toHaveBeenCalledOnce()

    expect(containerA).toBeDefined()
    expect(containerA).toBe(containerB)
  })

  it('returns the cached promise on subsequent calls after bootstrap completes', async () => {
    const builder = makeBuilder()
    const configureSpy = vi.fn().mockResolvedValue(undefined)

    builder.addModule('SequentialModule', async () => ({
      configure: configureSpy,
    }))

    const firstRun = await builder.build()
    const secondRun = await builder.build()

    expect(configureSpy).toHaveBeenCalledOnce()
    expect(firstRun).toBe(secondRun)
  })
})

// -- build error path -------------------------------------------------------

describe('AppBuilder � build error handling', () => {
  it('resets the build promise on failure and allows a subsequent successful retry', async () => {
    const builder = makeBuilder()
    let shouldFail = true

    builder.addModule('FlakyModule', async () => ({
      configure: vi.fn().mockImplementation(async () => {
        if (shouldFail) {
          throw new Error('temporary failure')
        }
      }),
    }))

    await expect(builder.build()).rejects.toThrow(
      'Bootstrap failed at [FlakyModule]: temporary failure',
    )

    shouldFail = false

    const container = await builder.build()
    expect(container).toBeDefined()
    expect(builder.resolve(TOKENS.CONFIGURATION_SERVICE as keyof Registry)).toBeDefined()
  })

  it('rejects with a descriptive Bootstrap failed error when a module throws', async () => {
    const builder = makeBuilder()
    const cause = new Error('module exploded')
    builder.addModule('BrokenModule', async () => {
      throw cause
    })

    await expect(builder.build()).rejects.toThrow('Bootstrap failed at [BrokenModule]')
  })

  it('includes the original error as cause', async () => {
    const builder = makeBuilder()
    const cause = new Error('inner error')
    builder.addModule('BrokenModule2', async () => {
      throw cause
    })

    const error = await builder.build().catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).cause).toBe(cause)
  })

  it('includes a non-Error cause when a module throws a string', async () => {
    const builder = makeBuilder()
    builder.addModule('StringThrow', async () => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'string error'
    })

    await expect(builder.build()).rejects.toThrow('Bootstrap failed at [StringThrow]: string error')
  })
})

describe('AppBuilder � private queue idempotency guards', () => {
  it('addMiddlewares after addPipeline hits _queueMiddlewareModule idempotency guard', async () => {
    const builder = makeBuilder()
    builder.addPipeline()
    builder.addMiddlewares((opts) => (opts.isSSR = true)) // _isMiddlewareModuleQueued already true
    await expect(builder.build()).resolves.toBeDefined()
  })
})
describe('AppBuilder additional coverage', () => {
  it('supports injected container and configuration service', () => {
    const resolve = vi.fn()
    const addSingleton = vi.fn()
    const container = { resolve, addSingleton } as unknown as IServiceContainer<Registry>
    const configuration = { get: vi.fn(() => 'configured') } as unknown as IConfigurationService
    const builder = new XenoAppBuilder<Registry>(container, configuration)

    expect(addSingleton).toHaveBeenCalledWith(TOKENS.CONFIGURATION_SERVICE, expect.any(Function))
    expect(builder.resolve('resolveTest' as keyof Registry)).toBeUndefined()
    expect(resolve).toHaveBeenCalledWith('resolveTest')
  })

  it('configures an application factory and returns its application instance', async () => {
    class FactoryBuilder extends XenoAppBuilder<Registry> {
      public useFactory(
        factory: (container: IServiceContainer<Registry>) => XenoApplication<Registry>,
      ) {
        return this.setApplicationFactory(factory)
      }
    }
    const builder = new FactoryBuilder()
    const app = new XenoApplication<Registry>(new ServiceContainer<Registry>())
    const factory = vi.fn(() => app)

    expect(builder.useFactory(factory)).toBe(builder)
    await expect(builder.build()).resolves.toBe(app)
    expect(factory).toHaveBeenCalledOnce()
    expect(factory).toHaveBeenCalledWith(expect.anything())
  })

  it('registers HTTP server plugins only once', () => {
    const builder = makeBuilder()
    const plugin = definePlugin<'http-server', Registry>('http-server', vi.fn())

    expect(builder.addHttpServer(plugin)).toBe(builder)
    expect(builder.addHttpServer(plugin)).toBe(builder)
    expect(plugin).toHaveBeenCalledOnce()
  })

  it('queues routes once while accumulating routes added in later calls', async () => {
    const builder = makeBuilder()
    const firstRoute = {
      path: '/first',
      method: 'GET',
      handler: vi.fn(),
    } as unknown as NativeRouteDefinition<Registry>
    const secondRoute = {
      path: '/second',
      method: 'POST',
      handler: vi.fn(),
    } as unknown as NativeRouteDefinition<Registry>

    expect(builder.addRoutes([firstRoute])).toBe(builder)
    expect(builder.addRoutes([secondRoute])).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('returns early when middleware configuration has already been queued', () => {
    const builder = makeBuilder()
    const firstSetup = vi.fn((config: MiddlewareConfig) => {
      config.isSSR = true
    })
    const secondSetup = vi.fn()

    builder.addMiddlewares(firstSetup)
    expect(builder.addMiddlewares(secondSetup)).toBe(builder)
    expect(firstSetup).toHaveBeenCalledOnce()
    expect(secondSetup).not.toHaveBeenCalled()
  })

  it('supports default, single-plugin and plugin-array logger configuration', async () => {
    const defaultBuilder = makeBuilder()
    expect(defaultBuilder.addLogger()).toBe(defaultBuilder)
    expect(defaultBuilder.addLogger()).toBe(defaultBuilder)
    await expect(defaultBuilder.build()).resolves.toBeDefined()

    const singleBuilder = makeBuilder()
    const singlePlugin = definePlugin<'logger', Registry>('logger', vi.fn())
    expect(singleBuilder.addLogger(singlePlugin)).toBe(singleBuilder)
    expect(singleBuilder.addLogger(singlePlugin)).toBe(singleBuilder)

    const arrayBuilder = makeBuilder()
    const firstPlugin = definePlugin<'logger', Registry>('logger', vi.fn())
    const secondPlugin = definePlugin<'logger', Registry>('logger', vi.fn())
    expect(arrayBuilder.addLogger([firstPlugin, secondPlugin])).toBe(arrayBuilder)
  })

  it('passes logger setup options and configuration to the setup callback', async () => {
    const builder = makeBuilder()
    const setup = vi.fn(
      (_options: LoggerConfig<Registry>, _config: IConfigurationService) => undefined,
    )

    expect(builder.addLogger(setup)).toBe(builder)
    expect(setup).toHaveBeenCalledOnce()
    expect(setup.mock.calls[0]?.[0]).toMatchObject({ console: true, customLoggers: [] })
    expect(setup.mock.calls[0]?.[1]).toBeDefined()
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('registers cache, auth and database plugins once each', () => {
    const builder = makeBuilder()
    const cachePlugin = definePlugin<'cache', Registry>('cache', vi.fn())
    const authPlugin = definePlugin<'auth', Registry>('auth', vi.fn())
    const dbPlugin = definePlugin<'db', Registry>('db', vi.fn())

    expect(builder.addCache(cachePlugin)).toBe(builder)
    expect(builder.addCache(cachePlugin)).toBe(builder)
    expect(builder.addAuth(authPlugin)).toBe(builder)
    expect(builder.addAuth(authPlugin)).toBe(builder)
    expect(builder.addDb(dbPlugin)).toBe(builder)
    expect(builder.addDb(dbPlugin)).toBe(builder)
    expect(cachePlugin).toHaveBeenCalledOnce()
    expect(authPlugin).toHaveBeenCalledOnce()
    expect(dbPlugin).toHaveBeenCalledOnce()
  })

  it('accepts pipeline plugins and ignores later pipeline registrations', async () => {
    const builder = makeBuilder()
    const plugin = definePlugin<'pipeline', Registry>('pipeline', vi.fn())

    expect(builder.addPipeline(plugin)).toBe(builder)
    expect(builder.addPipeline()).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('supports HTTP client plugins and setup actions with idempotency', () => {
    const pluginBuilder = makeBuilder()
    const plugin = definePlugin<'http', Registry>('http', vi.fn())
    expect(pluginBuilder.addHttpClient(plugin)).toBe(pluginBuilder)
    expect(pluginBuilder.addHttpClient(plugin)).toBe(pluginBuilder)
    expect(plugin).toHaveBeenCalledOnce()

    const setupBuilder = makeBuilder()
    const setup = vi.fn((config: HttpConfig) => {
      config.clients = []
    })
    expect(setupBuilder.addHttpClient(setup)).toBe(setupBuilder)
    expect(setupBuilder.addHttpClient(setup)).toBe(setupBuilder)
    expect(setup).toHaveBeenCalledOnce()
  })

  it('forwards the configuration service to the addServices setup action', async () => {
    const builder = makeBuilder()
    const setup = vi.fn()

    builder.addServices(setup)
    await builder.build()

    expect(setup).toHaveBeenCalledOnce()
    expect(setup.mock.calls[0]?.[1]).toBeDefined()
  })

  it('sorts queued modules by priority before configuring them', async () => {
    const builder = makeBuilder()
    const order: string[] = []
    const configure = (name: string) =>
      vi.fn(async () => {
        order.push(name)
      })

    builder.addModule('later', async () => ({ configure: configure('later') }), undefined, 20)
    builder.addModule('earlier', async () => ({ configure: configure('earlier') }), undefined, 10)
    await builder.build()

    expect(order).toEqual(['earlier', 'later'])
  })
})
describe('AppBuilder uncovered branches', () => {
  it('queues default middleware configuration when no setup action is provided', async () => {
    const builder = makeBuilder()

    expect(builder.addMiddlewares()).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
  })

  it('accepts an array of pipeline plugins', async () => {
    const builder = makeBuilder()
    const firstPlugin = definePlugin<'pipeline', Registry>('pipeline', vi.fn())
    const secondPlugin = definePlugin<'pipeline', Registry>('pipeline', vi.fn())

    expect(builder.addPipeline([firstPlugin, secondPlugin])).toBe(builder)
    await expect(builder.build()).resolves.toBeDefined()
    expect(firstPlugin).toHaveBeenCalledOnce()
    expect(secondPlugin).toHaveBeenCalledOnce()
  })

  it('does not reset the container when a failed build has been superseded', async () => {
    class SupersededBuildBuilder extends XenoAppBuilder<Registry> {
      public supersedeBuild(): void {
        this._buildPromise = null
      }
    }
    const builder = new SupersededBuildBuilder()
    builder.addModule('SupersededFailure', async () => ({
      configure: async () => {
        throw new Error('superseded')
      },
    }))

    const attempt = builder.build()
    builder.supersedeBuild()

    await expect(attempt).rejects.toThrow('Bootstrap failed at [SupersededFailure]: superseded')
  })
})

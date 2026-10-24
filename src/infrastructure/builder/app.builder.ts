import type {
  AuthModuleOptions,
  AuthPlugin,
  CacheConfig,
  CachePlugin,
  ContextPlugin,
  DbPlugin,
  HttpConfig,
  HttpPlugin,
  HttpServerPlugin,
  IAppBuilder,
  IConfigurationService,
  IModule,
  IServiceContainer,
  LoggerConfig,
  LoggerPlugin,
  MiddlewareConfig,
  NativeRouteDefinition,
  Nullable,
  PipelinePlugin,
  SetupAction,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards, LOG_LEVEL, TOKENS } from '@xeno-js/shared'

import { EnvironmentConfigurationService } from '../configuration'
import { ViteConfigurationService } from '../configuration/vite.configuration'
import { ServiceContainer } from '../container/service-container'
import {
  CacheModule,
  ContextModule,
  CqrsModule,
  LoggerModule,
  MiddlewareModule,
  RouteModule,
} from '../modules'
import { withAuth, withCustomHttp } from '../plugin'
import { XenoApplication } from '../xeno_application/xeno.application'

/**
 * @description The AppBuilder class provides a fluent, .NET-style API for configuring and bootstrapping the application. It orchestrates the registration of various modules (CQRS, HTTP, Database, Logging, Auth) into the ServiceContainer.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
interface QueuedModule {
  priority: number
  name: string
  action: () => Promise<void>
}

/**
 * @description The AppBuilder class provides a fluent, .NET-style API for configuring and bootstrapping the application.
 * It orchestrates the registration of various modules (CQRS, HTTP, Database, Logging, Auth) into the ServiceContainer.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class XenoAppBuilder<
  TRegistry extends XenoRegistry = XenoRegistry,
  TApp extends XenoApplication<TRegistry> = XenoApplication<TRegistry>,
> implements IAppBuilder<TRegistry, TApp> {
  protected _container: IServiceContainer<TRegistry> = new ServiceContainer<TRegistry>()
  protected readonly _configuration: IConfigurationService
  protected _buildPromise: Nullable<Promise<TApp>> = null
  private _pipelinePlugins: PipelinePlugin<TRegistry>[] = []
  private _appFactory: Nullable<(container: IServiceContainer<TRegistry>) => TApp> = null

  constructor(
    container?: IServiceContainer<TRegistry>,
    configurationService?: 'vite' | 'node' | IConfigurationService,
  ) {
    this._container = container ?? new ServiceContainer<TRegistry>()

    this._configuration = this._getConfigurationService(configurationService)
    this._container.addSingleton(TOKENS.CONFIGURATION_SERVICE, () => this._configuration)
  }

  private _getConfigurationService(service?: 'vite' | 'node' | IConfigurationService) {
    if (!Guards.isDefined(service) || service === 'node')
      return new EnvironmentConfigurationService()

    if (service === 'vite') return new ViteConfigurationService()

    return service
  }

  // --- Module Configurations ---
  protected readonly _modules: QueuedModule[] = []

  // --- Specific Configurations ---
  private _middlewareConfig: MiddlewareConfig = {
    isSSR: false,
    cors: {
      enabled: true,
      enablePreflight: true,
      withCredentials: true,
      allowOrigins: [],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    },
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowSeconds: 60,
    },
    csrf: undefined,
    trustedIpHeader: undefined,
    trustedProxies: [],
    authCookieName: 'sb-access-token',
  }
  private _routes: NativeRouteDefinition<TRegistry>[] = []

  // --- Module Queuing Flags ---
  private _isMiddlewareModuleQueued = false
  private _isPipelineModuleQueued = false
  private _isLoggerModuleQueued = false
  private _isAuthModuleQueued = false
  private _isDbContextModuleQueued = false
  private _isConcurrencyServiceQueued = false
  private _isCacheModuleQueued = false
  private _isHttpCoreQueued = false
  private _isHttpServerQueued = false
  private _isRouteModuleQueued = false
  private _isContextModuleQueued = false

  // ─────────────────────────────────────────────────────────────────────────────
  // Application Modules Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  protected setApplicationFactory(
    factory: (container: IServiceContainer<TRegistry>) => TApp,
  ): this {
    this._appFactory = factory
    return this
  }

  /**
   * @description Add http server plugin to the application.
   * @param plugin - The http server plugin to be added.
   * @returns {this} The current instance of the class.
   */
  public addHttpServer(plugin: HttpServerPlugin<TRegistry>): this {
    if (this._isHttpServerQueued) return this
    plugin(this, this._configuration)
    this._isHttpServerQueued = true
    return this
  }

  /**
   * @description Add a new route to the application.
   * @param routes - The routes to be added.
   * @returns {this} The current instance of the class.
   */
  public addRoutes(routes: NativeRouteDefinition<TRegistry>[]): this {
    this._routes.push(...routes)

    if (this._isRouteModuleQueued) return this
    this._modules.push({
      priority: 5,
      name: 'RouteModule',
      action: async () => {
        const routeModule = new RouteModule<TRegistry>()
        await routeModule.configure(this._container, this._routes)
      },
    })
    this._isRouteModuleQueued = true
    return this
  }

  /**
   * @description Enables the use of middlewares in the application. Middlewares can be used for cross-cutting concerns such as logging, authentication, and request/response manipulation.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addMiddlewares(setupAction?: SetupAction<MiddlewareConfig, IConfigurationService>): this {
    if (this._isMiddlewareModuleQueued) return this
    if (Guards.isDefined(setupAction)) setupAction(this._middlewareConfig, this._configuration)

    this._modules.push({
      priority: 4,
      name: 'MiddlewareModule',
      action: async () => {
        const middlewareModule = new MiddlewareModule<TRegistry>()
        await middlewareModule.configure(this._container, {
          ...this._middlewareConfig,
          routes: this._routes,
        })
      },
    })

    this._isMiddlewareModuleQueued = true
    return this
  }

  /**
   * @description Enables the use of context in the application. Context can be used to store and manage request-specific data, such as user information, correlation IDs, and other metadata that needs to be accessible throughout the request lifecycle.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addContext(plugin?: ContextPlugin<TRegistry>): this {
    if (this._isContextModuleQueued) return this

    if (Guards.isDefined(plugin)) plugin(this, this._configuration)
    else
      this._modules.push({
        priority: 0,
        name: 'ContextModule',
        action: async () => {
          const contextModule = new ContextModule<TRegistry>()
          await contextModule.configure(this._container)
        },
      })

    this._isContextModuleQueued = true
    return this
  }

  /**
   * @description Configures the logger for the application. This method allows you to set up logging options such as log level, console logging, and integration with custom logging services.
   * @param plugin A LoggerPlugin instance or an array of LoggerPlugin instances to configure the logger.
   * @returns The current instance of AppBuilder for method chaining.
   */
  public addLogger(plugin?: LoggerPlugin<TRegistry> | LoggerPlugin<TRegistry>[]): this

  /**
   * @description Configures the logger for the application. This method allows you to set up logging options such as log level, console logging, and integration with custom logging services.
   * @param setupAction A callback function that receives a LoggerConfig object to configure the logger settings.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addLogger(setupAction?: SetupAction<LoggerConfig<TRegistry>, IConfigurationService>): this

  public addLogger(
    pluginOrSetup?:
      | LoggerPlugin<TRegistry>
      | LoggerPlugin<TRegistry>[]
      | SetupAction<LoggerConfig<TRegistry>, IConfigurationService>,
  ): this {
    if (this._isLoggerModuleQueued) return this

    if (!Guards.isDefined(pluginOrSetup)) {
      this._modules.push({
        priority: 1,
        name: 'LoggerModule',
        action: async () => {
          const module = new LoggerModule<TRegistry>()
          await module.configure(this._container, {
            level: LOG_LEVEL.DEBUG,
            console: true,
            builder: this,
            config: this._configuration,
          })
        },
      })
    } else if (Guards.isArray(pluginOrSetup)) {
      this._modules.push({
        priority: 1,
        name: 'LoggerModule',
        action: async () => {
          const module = new LoggerModule<TRegistry>()
          await module.configure(this._container, {
            console: false,
            builder: this,
            config: this._configuration,
            plugins: pluginOrSetup,
          })
        },
      })
    } else if ((pluginOrSetup as LoggerPlugin<TRegistry>).__kind === 'logger') {
      this._modules.push({
        priority: 1,
        name: 'LoggerModule',
        action: async () => {
          const module = new LoggerModule<TRegistry>()
          await module.configure(this._container, {
            console: false,
            builder: this,
            config: this._configuration,
            plugins: [pluginOrSetup as LoggerPlugin<TRegistry>],
          })
        },
      })
    } else {
      const loggerConfig = {
        console: true,
        level: LOG_LEVEL.DEBUG,
        customLoggers: [],
      }
      const setupAction = pluginOrSetup as SetupAction<
        LoggerConfig<TRegistry>,
        IConfigurationService
      >
      setupAction(loggerConfig, this._configuration)
      this._modules.push({
        priority: 1,
        name: 'LoggerModule',
        action: async () => {
          const module = new LoggerModule<TRegistry>()
          await module.configure(this._container, {
            ...loggerConfig,
            builder: this,
            config: this._configuration,
          })
        },
      })
    }

    this._isLoggerModuleQueued = true
    return this
  }

  /**
   * @description Configures the caching settings for the application. This method allows you to set up caching options such as Redis configuration or in-memory caching.
   * @param plugin Optional plugin function to configure the caching module.
   * @defaults The default caching module is the in-memory caching module.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addCache(plugin?: CachePlugin<TRegistry>): this
  public addCache(setupAction?: SetupAction<CacheConfig, IConfigurationService>): this
  public addCache(
    pluginOrSetup?: CachePlugin<TRegistry> | SetupAction<CacheConfig, IConfigurationService>,
  ): this {
    if (this._isCacheModuleQueued) return this

    if (!Guards.isDefined(pluginOrSetup))
      this._modules.push({
        priority: 2,
        name: 'CacheModule',
        action: async () => {
          await new CacheModule<TRegistry>().configure(this._container, { inMemory: true })
        },
      })
    else if ((pluginOrSetup as CachePlugin<TRegistry>).__kind === 'cache')
      (pluginOrSetup as CachePlugin<TRegistry>)(this, this._configuration)
    else {
      const cacheConfig: CacheConfig = {
        inMemory: true,
      }
      const setupAction = pluginOrSetup as SetupAction<CacheConfig, IConfigurationService>

      setupAction(cacheConfig, this._configuration)

      this._modules.push({
        priority: 2,
        name: 'CacheModule',
        action: async () => {
          await new CacheModule<TRegistry>().configure(this._container, cacheConfig)
        },
      })
    }

    this._isCacheModuleQueued = true
    return this
  }

  /**
   * @description Configures the authentication client for the application. This method allows you to set up authentication options such as the authentication server URL, API key, and additional options.
   * @param plugin A plugin function that configures the authentication client.
   * @returns The current instance of AppBuilder for method chaining.
   */
  public addAuth(plugin: AuthPlugin<TRegistry>): this
  /**
   * @description Configures the authentication client for the application. This method allows you to set up authentication options such as the authentication server URL, API key, and additional options.
   * @param setupAction A function that configures the authentication client.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addAuth(
    setupAction: SetupAction<AuthModuleOptions<TRegistry>, IConfigurationService>,
  ): this

  public addAuth(
    pluginOrSetup:
      AuthPlugin<TRegistry> | SetupAction<AuthModuleOptions<TRegistry>, IConfigurationService>,
  ): this {
    if (this._isAuthModuleQueued) return this
    if ((pluginOrSetup as AuthPlugin<TRegistry>).__kind === 'auth')
      (pluginOrSetup as AuthPlugin<TRegistry>)(this, this._configuration)
    else {
      withAuth<TRegistry>(
        pluginOrSetup as SetupAction<AuthModuleOptions<TRegistry>, IConfigurationService>,
      )(this, this._configuration)
    }
    this._isAuthModuleQueued = true
    return this
  }

  /**
   * @description Configures the database settings for the application. This method allows you to set up database options such as enabling/disabling the database, connection string, and table definitions.
   * @param plugin A callback function that receives a DbConfig object to configure the database settings.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addDb(plugin: DbPlugin<TRegistry>): this {
    if (this._isDbContextModuleQueued) return this
    plugin(this, this._configuration)
    this._isDbContextModuleQueued = true
    return this
  }

  /**
   * @description Enables the use of the service for concurrency control in the application. This method allows you to limit the number of concurrent asynchronous tasks being executed, which is useful for managing system resources and preventing event loop blocking during massive batch operations.
   * @returns The current instance of AppBuilder for method chaining.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  public addConcurrencyService(): this {
    if (this._isConcurrencyServiceQueued) return this
    this._isConcurrencyServiceQueued = true
    this._modules.push({
      priority: 40,
      name: 'ConcurrencyServiceModule',
      action: async () => {
        const { PLimitConcurrencyService } = await import('../services/concurrency')
        this._container.addSingleton(
          TOKENS.CONCURRENCY_SERVICE,
          () => new PLimitConcurrencyService(),
        )
      },
    })
    return this
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CQRS Pipeline Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * @description Configures the CQRS pipeline settings for the application. This method allows you to set up various aspects of the CQRS pipeline, including performance monitoring, authorization, validation, command bus settings, and query bus settings.
   * @param setupAction A callback function that receives a PipelineConfig object to configure the CQRS pipeline settings.
   * @returns The current instance of AppBuilder for method chaining.
  
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  public addPipeline(
    pluginOrPlugins?: PipelinePlugin<TRegistry> | PipelinePlugin<TRegistry>[],
  ): this {
    if (this._isPipelineModuleQueued) return this

    if (Guards.isDefined(pluginOrPlugins))
      this._pipelinePlugins = Guards.isArray(pluginOrPlugins) ? pluginOrPlugins : [pluginOrPlugins]

    this._modules.push({
      priority: 5,
      name: 'CqrsModule',
      action: async () => {
        await new CqrsModule<TRegistry>().configure(this._container, {
          plugins: this._pipelinePlugins,
          builder: this,
        })
      },
    })

    this._isPipelineModuleQueued = true
    return this
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HTTP & Resilience Configuration
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * @description Configures the HTTP core settings for the application. This method allows you to set up HTTP core options such as data source token and HTTP client configuration.
   * @param plugin A HttpPlugin object that contains the HTTP core configuration.
   * @returns The current instance of AppBuilder for method chaining.
   */
  public addHttpClient(plugin: HttpPlugin<TRegistry>): this

  /**
   * @description Configures the HTTP core settings for the application. This method allows you to set up HTTP core options such as data source token, HTTP client configuration, and resilience settings.
   * @param setupAction A callback function that receives an SetupAction<HttpConfig, IConfigurationService> object to configure the HTTP core settings.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addHttpClient(setupAction: SetupAction<HttpConfig, IConfigurationService>): this

  public addHttpClient(
    pluginOrSetup: HttpPlugin<TRegistry> | SetupAction<HttpConfig, IConfigurationService>,
  ): this {
    if (this._isHttpCoreQueued) return this
    if ((pluginOrSetup as HttpPlugin<TRegistry>).__kind === 'http')
      (pluginOrSetup as HttpPlugin<TRegistry>)(this, this._configuration)
    else {
      const httpConfig: HttpConfig = {
        clients: [],
      }
      const setupAction = pluginOrSetup as SetupAction<HttpConfig, IConfigurationService>
      setupAction(httpConfig, this._configuration)
      withCustomHttp<TRegistry>(httpConfig)(this, this._configuration)
    }

    this._isHttpCoreQueued = true
    return this
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency Injection Pass-through Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * @description Registers services in the application. This method allows you to add custom services to the dependency injection container, enabling modular and organized configuration of services.
   * @param setupAction A callback function that receives the IServiceContainer to register services.
   * @returns The current instance of AppBuilder for method chaining.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addServices(
    setupAction: SetupAction<IServiceContainer<TRegistry>, IConfigurationService>,
    priority = 99,
  ): this {
    this._modules.push({
      priority,
      name: 'ClientServicesModule',
      action: async () => {
        setupAction(this._container, this._configuration)
      },
    })
    return this
  }

  /**
   * @description Registers a module in the application. A module is a self-contained unit of functionality that can configure services and dependencies in the service container. This method allows you to add custom modules to the application, enabling modular and organized configuration of services.
   * @param factory A factory function that creates the module instance.
   * @param opts Optional configuration options for the module.
   * @returns The current instance of AppBuilder for method chaining.
   *
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public addModule<T>(
    name: string,
    factory: () => Promise<IModule<TRegistry, T>>,
    opts?: T,
    priority = 50,
  ): this {
    this._modules.push({
      priority,
      name,
      action: async () => {
        const module = await factory()
        await module.configure(this._container, opts)
      },
    })
    return this
  }

  /**
   * @description Resolves a service from the dependency injection container.
   * @param token The injection token used to identify the service.
   * @returns The resolved service instance.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public resolve<K extends keyof TRegistry>(token: K): TRegistry[K] {
    return this._container.resolve(token)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Build
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * @description Finalizes the configuration and initializes all registered modules in the container.
   * @returns The fully configured ServiceContainer.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  public build(): Promise<TApp> {
    if (Guards.isDefined(this._buildPromise)) {
      return this._buildPromise
    }

    const attempt = this._executeBuild()
    this._buildPromise = attempt

    void attempt.then(
      () => {
        /* noop */
      },
      async () => {
        if (this._buildPromise === attempt) {
          this._buildPromise = null
          await this._resetContainer()
        }
      },
    )

    return attempt
  }

  protected async _resetContainer(): Promise<void> {
    await this._container.dispose()
    this._container = new ServiceContainer<TRegistry>()
    this._container.addSingleton(TOKENS.CONFIGURATION_SERVICE, () => this._configuration)
  }

  /**
   * @description Executes the build process by initializing all registered modules in the container.
   */
  private async _executeBuild(): Promise<TApp> {
    console.info('⚙️ Bootstrapping application modules...')
    if (!this._isContextModuleQueued) {
      if (this._configuration instanceof ViteConfigurationService)
        throw new Error(
          'Cannot add node context module to the application builder when using ViteConfigurationService. \nPlease use addContext passing a context plugin such as withPiniaContext() from @xeno-js/vue',
        )
      else this.addContext()
    }

    const sortedModules = [...this._modules].sort((a, b) => a.priority - b.priority)
    for (const queued of sortedModules) {
      try {
        await queued.action()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        console.error(`\n❌ [AppBuilder Fatal Error]`)
        console.error(`An error occurred while initializing the module:`)
        console.error(`👉 Module: **${queued.name}**`)
        console.error(`📝 Reason: ${errorMessage}\n`)

        if (error instanceof Error && Guards.isDefined(error.stack)) {
          console.error(error.stack)
        }

        throw new Error(`Bootstrap failed at [${queued.name}]: ${errorMessage}`, { cause: error })
      }
    }
    console.info('✅ Application modules bootstrapped successfully.')
    if (Guards.isDefined(this._appFactory)) return this._appFactory(this._container)

    return new XenoApplication<TRegistry>(this._container) as TApp
  }
}

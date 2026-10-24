import type { ILogger, IMiddleware, IRoute, Optional, RequestContext } from '@xeno-js/shared'
import type {
  IAllowMethod,
  IModule,
  IRequestContext,
  IServiceContainer,
  MiddlewareConfig,
  NativeRouteDefinition,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards, LOG_LEVEL } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { ClaimsIdentityMapper, GateKeeper, NoAuthGateKeeper } from '@/application'
import {
  AllowOriginMiddleware,
  AuthenticationMiddleware,
  CompositeMiddleware,
  CookieResponseMiddleware,
  CORSMiddleware,
  CsrfCookieMiddleware,
  CsrfMiddleware,
  MethodCheckMiddleware,
  OptionsMiddleware,
  RateLimitMiddleware,
  RequestContextMiddleware,
} from '@/presentation'

import { RateLimitKeyBuilder } from '../cache'
import { AllowMethodFactory } from '../factories'
import { HttpDispatcher } from '../http/dispatcher.http'
import {
  AllowOrigin,
  BearerTokenExtractor,
  ClientIpResolver,
  CsrfTokenService,
  EdgeCryptoService,
  HttpCookieExtractor,
  HttpHeaderExtractor,
} from '../services'
import { CacheModule } from './cache.module'
import { LoggerUtils } from './utils'

export class MiddlewareModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  MiddlewareConfig
> {
  public async configure(
    container: IServiceContainer<TRegistry>,
    opts: MiddlewareConfig & { routes: NativeRouteDefinition<TRegistry>[] },
  ): Promise<void> {
    if (!container.isRegistered(TOKENS.LOGGER))
      await LoggerUtils.addLogger(container, { level: LOG_LEVEL.INFO, console: true })

    const logger = container.resolve(TOKENS.LOGGER)
    const requestContext = container.resolve(TOKENS.REQUEST_CONTEXT) as IRequestContext<
      RequestContext,
      TRegistry
    >
    const configuration = container.resolve(TOKENS.CONFIGURATION_SERVICE)

    const allowMethod = new AllowMethodFactory().create<TRegistry>(opts.routes)

    container.addSingleton(
      TOKENS.SERVICE_EXTRACTOR,
      () =>
        new HttpHeaderExtractor(
          new HttpCookieExtractor(),
          opts.trustedIpHeader,
          opts.csrf?.cookieName ?? '__Host-xeno-csrf',
          opts.csrf?.headerName ?? 'x-csrf-token',
        ),
    )

    const getRouteMatcher = () => container.resolve(TOKENS.ROUTE_MATCHER)

    const withCredentials =
      Guards.isDefined(opts.cors?.withCredentials) && opts.cors?.withCredentials ? 'true' : 'false'

    const [optionsMw, cookieRespMw, corsMw, authMw, csrfMws] = [
      this._buildOptionsMiddleware(
        opts,
        requestContext,
        () => allowMethod,
        withCredentials,
        getRouteMatcher,
      ),
      this._buildCookieResponseMiddleware(opts, requestContext),
      this._buildCorsMiddleware(opts, requestContext, withCredentials, getRouteMatcher),
      this._createAuthMiddleware(container, requestContext, logger, opts),
      this._buildCsrfMiddlewares(opts, container, requestContext, getRouteMatcher),
    ]

    const rateLimitMw = await this._buildRateLimitMiddleware(
      opts,
      container,
      requestContext,
      logger,
    )

    const requestCtxMw = new RequestContextMiddleware(
      requestContext,
      container.resolve(TOKENS.SERVICE_EXTRACTOR),
      new ClientIpResolver(opts.trustedProxies),
      logger,
    )

    const defaultOrigin =
      configuration.get('APP_URL') ?? `http://localhost:${configuration.getNumber('PORT', 3000)}`
    const origins = !Guards.isNullOrEmpty(opts.cors?.allowOrigins)
      ? opts.cors.allowOrigins
      : [defaultOrigin]

    const allowOriginMw = new AllowOriginMiddleware(
      new AllowOrigin(origins),
      requestContext,
      logger,
      getRouteMatcher,
    )
    const methodCheckMw = new MethodCheckMiddleware(requestContext, allowMethod)

    const pipeline: IMiddleware[] = [
      requestCtxMw,
      ...(Guards.isDefined(cookieRespMw) ? [cookieRespMw] : []),
      allowOriginMw,
      ...(Guards.isDefined(optionsMw) && !Guards.isNullOrEmpty(opts.routes) ? [optionsMw] : []),
      ...(!Guards.isNullOrEmpty(opts.routes) ? [methodCheckMw] : []),
      ...(Guards.isDefined(corsMw) ? [corsMw] : []),
      ...(Guards.isDefined(rateLimitMw) ? [rateLimitMw] : []),
      authMw,
      ...(!Guards.isNullOrEmpty(csrfMws) ? csrfMws : []),
    ]

    container.addSingleton(TOKENS.MIDDLEWARE, () => new CompositeMiddleware(pipeline))

    container.addSingleton(
      TOKENS.HTTP_DISPATCHER,
      (c) =>
        new HttpDispatcher<TRegistry>(
          c.resolve(TOKENS.REQUEST_CONTEXT) as IRequestContext<RequestContext, TRegistry>,
          c.resolve(TOKENS.MIDDLEWARE),
          c.resolve(TOKENS.SERVICE_PROXY),
        ),
    )
  }

  private _buildCookieResponseMiddleware(
    opts: MiddlewareConfig,
    requestContext: IRequestContext<RequestContext, TRegistry>,
  ): Optional<IMiddleware> {
    if (!Guards.isDefined(opts.isSSR) || !opts.isSSR) return undefined

    return new CookieResponseMiddleware<TRegistry>(requestContext)
  }

  private _buildCsrfMiddlewares(
    opts: MiddlewareConfig,
    container: IServiceContainer<TRegistry>,
    requestContext: IRequestContext<RequestContext, TRegistry>,
    routePolicyCheck: () => IRoute<TRegistry>,
  ) {
    if (!Guards.isDefined(opts.csrf)) return []
    const csrf = opts.csrf

    container.addSingleton(TOKENS.CRYPTO_SERVICE, () => new EdgeCryptoService())
    container.addSingleton(TOKENS.CSRF_TOKEN_SERVICE, (c) => {
      return new CsrfTokenService(csrf.secret, c.resolve(TOKENS.CRYPTO_SERVICE))
    })

    return [
      new CsrfCookieMiddleware(requestContext, container.resolve(TOKENS.CSRF_TOKEN_SERVICE), csrf),
      new CsrfMiddleware(
        requestContext,
        container.resolve(TOKENS.CSRF_TOKEN_SERVICE),
        routePolicyCheck,
      ),
    ]
  }

  private async _buildRateLimitMiddleware(
    opts: MiddlewareConfig,
    container: IServiceContainer<TRegistry>,
    requestContext: IRequestContext<RequestContext, TRegistry>,
    logger: ILogger,
  ) {
    if (Guards.isDefined(opts.rateLimit?.enabled) && opts.rateLimit?.enabled) {
      const maxRequests = opts.rateLimit?.maxRequests ?? 100
      const windowSeconds = opts.rateLimit?.windowSeconds ?? 60

      if (!container.isRegistered(TOKENS.CACHE)) {
        await new CacheModule().configure(container)
      }

      return new RateLimitMiddleware(
        requestContext,
        container.resolve(TOKENS.CACHE),
        new RateLimitKeyBuilder(requestContext),
        logger,
        { maxRequests, windowSeconds },
      )
    }
  }

  private _buildCorsMiddleware(
    opts: MiddlewareConfig,
    requestContext: IRequestContext<RequestContext, TRegistry>,
    withCredentials: Optional<'true' | 'false'>,
    routePolicyCheck: () => IRoute<TRegistry>,
  ) {
    if (Guards.isDefined(opts.cors?.enabled) && opts.cors.enabled) {
      return new CORSMiddleware(requestContext, routePolicyCheck, withCredentials)
    }
  }

  private _buildOptionsMiddleware(
    opts: MiddlewareConfig,
    requestContext: IRequestContext<RequestContext, TRegistry>,
    allowMethod: () => IAllowMethod,
    withCredentials: Optional<'true' | 'false'>,
    routePolicyCheck: () => IRoute<TRegistry>,
  ) {
    if (Guards.isDefined(opts.cors?.enablePreflight) && opts.cors?.enablePreflight) {
      return new OptionsMiddleware(
        requestContext,
        allowMethod(),
        routePolicyCheck,
        opts.cors?.allowHeaders ?? [],
        withCredentials,
      )
    }
  }

  private _createAuthMiddleware(
    container: IServiceContainer<TRegistry>,
    requestContext: IRequestContext<RequestContext, TRegistry>,
    logger: ILogger,
    opts: MiddlewareConfig,
  ): IMiddleware {
    if (!container.isRegistered(TOKENS.TOKEN_SERVICE_EXTRACTOR)) {
      container.addSingleton(
        TOKENS.TOKEN_SERVICE_EXTRACTOR,
        () => new BearerTokenExtractor(opts.authCookieName ?? 'sb-access-token'),
      )
    }
    const tokenExtractor = container.resolve(TOKENS.TOKEN_SERVICE_EXTRACTOR)

    if (!container.isRegistered(TOKENS.BASE_AUTH_SERVICE)) {
      return new AuthenticationMiddleware(
        requestContext,
        tokenExtractor,
        new NoAuthGateKeeper(),
        logger,
      )
    }

    return new AuthenticationMiddleware(
      requestContext,
      tokenExtractor,
      new GateKeeper(() => {
        const scope = requestContext.getScope()
        if (!Guards.isDefined(scope)) {
          throw new Error('[GateKeeper Error]: No active scope found.')
        }
        return scope.resolve(TOKENS.BASE_AUTH_SERVICE)
      }, new ClaimsIdentityMapper()),
      logger,
    )
  }
}

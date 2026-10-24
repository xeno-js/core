import type { AuthModuleOptions, IModule, IServiceContainer, XenoRegistry } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { BearerTokenExtractor, CookieHandler } from '../services'

/**
 * @description AuthModule is responsible for registering authentication services and
 * the token extractor in the IoC container. If no custom tokenExtractor is provided,
 * it falls back to the default BearerTokenExtractor.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class AuthModule<TRegistry extends XenoRegistry = XenoRegistry> implements IModule<
  TRegistry,
  AuthModuleOptions<TRegistry>
> {
  public async configure(
    container: IServiceContainer<TRegistry>,
    opts: AuthModuleOptions<TRegistry>,
  ): Promise<void> {
    if (!Guards.isDefined(opts.authService))
      throw new Error(
        '[AuthModule Error]: An authService instance is required to configure AuthModule.',
      )

    if (Guards.isDefined(opts.cookieHandlerOptions)) {
      if (Guards.isDefined(opts.cookieHandlerOptions.cookieHandlerCustom)) {
        container.addScoped(TOKENS.COOKIE_HANDLER, (c) =>
          opts.cookieHandlerOptions!.cookieHandlerCustom!(c),
        )
      } else if (
        Guards.isDefined(opts.cookieHandlerOptions.enableDefault) &&
        opts.cookieHandlerOptions.enableDefault.enable
      ) {
        container.addScoped(
          TOKENS.COOKIE_HANDLER,
          (c) =>
            new CookieHandler(
              c.resolve(TOKENS.NETWORK_CONTEXT_ACCESSOR),
              c.resolve(TOKENS.CONFIGURATION_SERVICE),
              opts.cookieHandlerOptions!.enableDefault?.options,
            ),
        )
      }
    }

    this.getExtractor(opts, container)

    container.addScoped(TOKENS.AUTH_SERVICE, (c) => opts.authService(c))
    container.addScoped(TOKENS.BASE_AUTH_SERVICE, (c) => c.resolve(TOKENS.AUTH_SERVICE))
  }

  private getExtractor(
    opts: AuthModuleOptions<TRegistry>,
    container: IServiceContainer<TRegistry>,
  ): void {
    if (Guards.isDefined(opts.tokenExtractor)) {
      container.addSingleton(TOKENS.TOKEN_SERVICE_EXTRACTOR, (c) => opts.tokenExtractor!(c))
    } else {
      container.addSingleton(
        TOKENS.TOKEN_SERVICE_EXTRACTOR,
        () => new BearerTokenExtractor(opts.defaultCookieName ?? 'sb-access-token'),
      )
    }
  }
}

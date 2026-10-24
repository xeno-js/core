import type { NativeRouteDefinition, XenoRegistry } from '@xeno-js/shared'

/**
 * @description Add CORS headers to a route definition.
 * Remember to add CORS middleware to your application during bootstrap.
 *
 * @param route The route to add CORS headers to.
 * @param allowOrigins Array of allowed origins (eg. ['https://example.com'] or ['*']).
 * @param withCredentials Whether to allow credentials. Default: true.
 * @returns The route definition with CORS headers added.
 */
export function withCors<TRegistry extends XenoRegistry = XenoRegistry>(
  route: NativeRouteDefinition<TRegistry>,
  allowOrigins: string[],
  withCredentials = true,
): NativeRouteDefinition<TRegistry> {
  return {
    ...route,
    security: {
      ...route.security,
      allowOrigins,
      withCredentials,
    },
  }
}

/**
 * @description Disable CSRF protection for a route definition.
 * Use this if you need to allow cross-origin requests without CSRF protection. (eg. for Server to Server or a Webhook)
 *
 * @param route The route to disable CSRF protection for.
 * @returns The route definition with CSRF protection disabled.
 */
export function withoutCsrf<TRegistry extends XenoRegistry = XenoRegistry>(
  route: NativeRouteDefinition<TRegistry>,
): NativeRouteDefinition<TRegistry> {
  return {
    ...route,
    security: {
      ...route.security,
      withCsrf: false,
    },
  }
}

/**
 * @description Allow CSRF protection for a route definition.
 * Remember to add CSRF middleware to your application during bootstrap.
 *
 * (Methods POST/PUT/PATCH/DELETE have a default CSRF protection if you added it during bootstrap, use this function if you want to force it for another method).
 *
 * @param route The route to disable CSRF protection for.
 * @returns The route definition with CSRF protection disabled.
 */
export function withCsrf<TRegistry extends XenoRegistry = XenoRegistry>(
  route: NativeRouteDefinition<TRegistry>,
): NativeRouteDefinition<TRegistry> {
  return {
    ...route,
    security: {
      ...route.security,
      withCsrf: true,
    },
  }
}

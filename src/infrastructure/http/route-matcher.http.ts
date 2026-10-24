import type {
  IRoute,
  NativeRouteDefinition,
  RouteHandlerContext,
  RoutePolicy,
  XenoRegistry,
} from '@xeno-js/shared'
import {
  Guards,
  HttpHelper,
  type Optional,
  RoutePatternHelper,
  STATUS_CODES,
} from '@xeno-js/shared'

interface CompiledRoute<TRegistry extends XenoRegistry> {
  readonly definition: NativeRouteDefinition<TRegistry>
  readonly pattern: RegExp
  readonly upperMethod: string
}

export class RouteMatcher<
  TRegistry extends XenoRegistry = XenoRegistry,
> implements IRoute<TRegistry> {
  constructor(private readonly _compiledRoutes: CompiledRoute<TRegistry>[]) {}

  public match(rawUrl: string, method: string): Optional<NativeRouteDefinition<TRegistry>> {
    const url = !Guards.isNullOrEmpty(rawUrl) ? rawUrl : '/'
    const safeUrl = HttpHelper.parseSafeUrl(url)
    const parsedPath = RoutePatternHelper.normalizePath(safeUrl.pathname)
    const upperMethod = method.toUpperCase()

    const matched = this._compiledRoutes.find(
      (r) => r.upperMethod === upperMethod && r.pattern.test(parsedPath),
    )

    if (Guards.isDefined(matched)) return matched.definition

    if (upperMethod === 'OPTIONS') {
      const pathExists = this._compiledRoutes.some((r) => r.pattern.test(parsedPath))

      if (pathExists) {
        return {
          path: parsedPath,
          method: 'OPTIONS',
          handler: async <TOutput>(ctx: RouteHandlerContext<TRegistry>) => {
            try {
              return await ctx.handle('__PREFLIGHT__' as keyof TRegistry)
            } catch {
              return {
                status: STATUS_CODES.NO_CONTENT,
                ok: true,
                headers: {},
                data: undefined as TOutput,
              }
            }
          },
        } as unknown as NativeRouteDefinition<TRegistry>
      }
    }

    return undefined
  }

  public checkRoutePolicy(path: string, method: string): RoutePolicy {
    const route = this.match(path, method)

    return {
      withCredentials: route?.security?.withCredentials,
      allowOrigins: route?.security?.allowOrigins,
      withCsrf: route?.security?.withCsrf,
      withCors: route?.security?.withCors,
    }
  }
}

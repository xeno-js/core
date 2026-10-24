import type { IRoute, IRouteFactory, NativeRouteDefinition, XenoRegistry } from '@xeno-js/shared'
import { RoutePatternHelper } from '@xeno-js/shared'

import { RouteMatcher } from '../http/route-matcher.http'

export class RouteMatcherFactory implements IRouteFactory {
  create<TRegistry extends XenoRegistry = XenoRegistry>(
    opts: NativeRouteDefinition<TRegistry>[],
  ): IRoute<TRegistry> {
    const routes = opts.map((r) => {
      const normalizedPath = RoutePatternHelper.normalizePath(r.path)
      const { pattern } = RoutePatternHelper.parse(normalizedPath)
      return {
        definition: r,
        pattern,
        upperMethod: r.method.toUpperCase(),
      }
    })
    return new RouteMatcher<TRegistry>(routes)
  }
}

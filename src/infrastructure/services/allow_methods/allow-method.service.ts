import type { IAllowMethod } from '@xeno-js/shared'
import { Guards, type HttpMethod, type Optional, RoutePatternHelper } from '@xeno-js/shared'

interface DynamicRoute {
  pattern: RegExp
  methods: HttpMethod[]
}

export class AllowMethodRegistry implements IAllowMethod {
  private readonly _staticRoutes = new Map<string, HttpMethod[]>()
  private readonly _dynamicRoutes: DynamicRoute[] = []

  public add(path: string, methods: HttpMethod[]): void {
    const normalizedPath = RoutePatternHelper.normalizePath(path)
    if (RoutePatternHelper.isDynamicPath(normalizedPath)) {
      const pattern = RoutePatternHelper.createRoutePattern(normalizedPath)
      this._dynamicRoutes.push({ pattern, methods })
    } else {
      this._staticRoutes.set(normalizedPath, methods)
    }
  }

  public check(path: string, method: HttpMethod): boolean {
    const cleanPath = RoutePatternHelper.normalizePath(path.split('?')[0].split('#')[0])
    const staticMethods = this._staticRoutes.get(cleanPath)
    if (Guards.isDefined(staticMethods)) return staticMethods.includes(method)
    for (const route of this._dynamicRoutes) {
      if (route.pattern.test(cleanPath)) return route.methods.includes(method)
    }
    return false
  }

  public getMethods(path: string): string {
    const cleanPath = RoutePatternHelper.normalizePath(path.split('?')[0].split('#')[0])
    const methods = this.findMethods(cleanPath)
    return Guards.isDefined(methods) ? methods.join(', ').toUpperCase() : ''
  }

  private findMethods(cleanPath: string): Optional<HttpMethod[]> {
    const staticMethods = this._staticRoutes.get(cleanPath)
    if (Guards.isDefined(staticMethods)) return staticMethods
    for (const route of this._dynamicRoutes) {
      if (route.pattern.test(cleanPath)) return route.methods
    }
    return undefined
  }
}

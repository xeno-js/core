import type { HttpMethod } from '@xeno-js/shared'
import type { IAllowMethod, NativeRouteDefinition, XenoRegistry } from '@xeno-js/shared'

import { AllowMethodRegistry } from '../services'

/**
 * @description Factory class responsible for creating instances of ZodValidatorService based on the provided configuration. It implements the IFactory interface, allowing for easy integration with dependency injection systems. The factory encapsulates the creation logic for the ZodValidatorService, including the initialization of the underlying ZodValidatorService instance with the specified configuration options such as URL and API key. This design promotes separation of concerns and allows for flexibility in managing ZodValidatorService instances across the application.

   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class AllowMethodFactory {
  public create<TRegistry extends XenoRegistry = XenoRegistry>(
    opts: NativeRouteDefinition<TRegistry>[],
  ): IAllowMethod {
    const allowMethodService = new AllowMethodRegistry()

    const routes = opts ?? []
    const routesMap = new Map<string, HttpMethod[]>()
    for (const r of routes) {
      const methods = routesMap.get(r.path) ?? []
      if (!methods.includes(r.method)) {
        methods.push(r.method)
      }
      routesMap.set(r.path, methods)
    }

    for (const [path, methods] of routesMap) {
      allowMethodService.add(path, methods)
    }

    return allowMethodService
  }
}

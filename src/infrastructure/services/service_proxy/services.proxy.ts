import type { IServiceProxy, IServiceScope, ServicesProxy, XenoRegistry } from '@xeno-js/shared'

/**
 * @description CreateServicesProxy is a service proxy factory that creates a proxy object for accessing services within a given scope.
 * The proxy object allows for convenient access to services by their names, providing a simplified way to retrieve and use services within the scope.
 */
export class CreateServicesProxy implements IServiceProxy {
  /**
   * @description CreateServicesProxy constructor.
   * @param scope - The scope within which services are accessed.
   * @returns A proxy object for accessing services within the specified scope.
   */
  public getServiceProxy<TRegistry extends XenoRegistry = XenoRegistry>(
    scope: IServiceScope<TRegistry>,
  ): ServicesProxy<TRegistry> {
    return new Proxy({} as ServicesProxy<TRegistry>, {
      get(_target, prop: string | symbol) {
        return scope.resolve(prop as keyof TRegistry)
      },
    })
  }
}

import type { IConfigurationService } from '@xeno-js/shared'
import type { IAppBuilder, IXenoApplication, XenoPlugin, XenoRegistry } from '@xeno-js/shared'

export const definePlugin = <
  TKind extends string,
  TRegistry extends XenoRegistry = XenoRegistry,
  TCtx = unknown,
>(
  kind: TKind,
  fn: (
    builder: IAppBuilder<TRegistry, IXenoApplication<TRegistry>>,
    config: IConfigurationService,
    ctx?: TCtx,
  ) => unknown,
): XenoPlugin<TKind, TRegistry, TCtx> => {
  Object.defineProperty(fn, '__kind', { value: kind, writable: false })
  return fn as XenoPlugin<TKind, TRegistry, TCtx>
}

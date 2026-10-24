import type { IMiddleware, ResponseDto, XenoRequest } from '@xeno-js/shared'

/**
 * @description A middleware that executes a list of middlewares in a chain.
 *
 * @author Xeno
 * @version 1.0.1
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class CompositeMiddleware implements IMiddleware {
  constructor(private readonly _middlewares: IMiddleware[]) {}

  public async execute<T>(
    req: XenoRequest,
    next: () => Promise<ResponseDto<T>>,
  ): Promise<ResponseDto<T>> {
    let currentNext = next

    for (let i = this._middlewares.length - 1; i >= 0; i--) {
      const currentBehavior = this._middlewares[i]
      const previousNext = currentNext
      currentNext = () => currentBehavior.execute(req, previousNext)
    }

    return currentNext()
  }
}

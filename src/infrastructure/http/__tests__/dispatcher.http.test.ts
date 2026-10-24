import type {
  IController,
  IMiddleware,
  RequestContext,
  ResponseDto,
  XenoRequest,
} from '@xeno-js/shared'
import type {
  IRequestContext,
  IServiceProxy,
  IServiceScope,
  ServicesProxy,
  XenoRegistry,
} from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { HttpDispatcher } from '../dispatcher.http'

interface TestInput {
  id: string
}
type TestRegistry = XenoRegistry<
  unknown,
  unknown,
  {
    testController: IController<TestInput, string>
  }
>
type TestResponse = ResponseDto<string>

function makeDispatcher(options?: {
  scope?: object
  controller?: unknown
  runMiddleware?: boolean
}) {
  const scope = options?.scope as IServiceScope<TestRegistry> | undefined
  const getScope = vi.fn(() => scope)
  const requestContext = { getScope } as unknown as IRequestContext<RequestContext, TestRegistry>
  const getServiceProxy = vi.fn(
    () =>
      ({
        testController: options?.controller,
      }) as unknown as ServicesProxy<TestRegistry>,
  )
  const serviceProxy = { getServiceProxy } as IServiceProxy
  const executeMiddleware = vi.fn(async (_req: XenoRequest, next: () => Promise<TestResponse>) =>
    options?.runMiddleware === false
      ? { status: 202, ok: true, headers: {}, data: { success: true, data: 'skipped', meta: {} } }
      : next(),
  )
  const middleware = { execute: executeMiddleware } as unknown as IMiddleware

  return {
    dispatcher: new HttpDispatcher<TestRegistry>(requestContext, middleware, serviceProxy),
    getScope,
    getServiceProxy,
    executeMiddleware,
  }
}

function makeRequest(): XenoRequest {
  return Object.assign(new Request('http://localhost/test'), { path: '/test' })
}

function makeResponse(data: string): TestResponse {
  return {
    status: 200,
    ok: true,
    headers: {},
    data: { success: true, data, meta: {} },
  }
}

describe('HttpDispatcher', () => {
  it('runs the controller through middleware using the active scope', async () => {
    const scope = {} as IServiceScope<TestRegistry>
    const response = makeResponse('completed')
    const handleController = vi.fn(
      async (_input: TestInput | undefined, _signal: AbortSignal | undefined) => response,
    )
    const controller = { handle: handleController }
    const { dispatcher, getScope, getServiceProxy, executeMiddleware } = makeDispatcher({
      scope,
      controller,
    })
    const request = makeRequest()
    const input = { id: 'item-1' }

    await expect(dispatcher.handle(request, 'testController', input)).resolves.toBe(response)

    expect(executeMiddleware).toHaveBeenCalledOnce()
    expect(executeMiddleware).toHaveBeenCalledWith(request, expect.any(Function))
    expect(getScope).toHaveBeenCalledOnce()
    expect(getServiceProxy).toHaveBeenCalledWith(scope)
    expect(handleController).toHaveBeenCalledWith(input, request.signal)
  })

  it('passes undefined input and the request signal to the controller when input is omitted', async () => {
    const handleController = vi.fn(
      async (_input: TestInput | undefined, _signal: AbortSignal | undefined) =>
        makeResponse('no input'),
    )
    const controller: IController<TestInput, string> = { handle: handleController }
    const { dispatcher } = makeDispatcher({ scope: {}, controller })
    const request = makeRequest()

    await dispatcher.handle(request, 'testController')

    expect(handleController.mock.calls[0]?.[0]).toBeUndefined()
    expect(handleController.mock.calls[0]?.[1]).toBe(request.signal)
  })

  it('throws when invoked without an active scope', async () => {
    const { dispatcher, getServiceProxy } = makeDispatcher({ scope: undefined })

    await expect(dispatcher.handle(makeRequest(), 'testController')).rejects.toThrow(
      '[HttpDispatcher Error]: Active scope not found. Execution outside RequestContext.',
    )
    expect(getServiceProxy).not.toHaveBeenCalled()
  })

  it.each([
    ['missing controller', undefined],
    ['controller without handle', { execute: vi.fn() }],
    ['non-function handle', { handle: 'not callable' }],
  ])('rejects a %s', async (_description, controller) => {
    const { dispatcher, getServiceProxy } = makeDispatcher({ scope: {}, controller })

    await expect(dispatcher.handle(makeRequest(), 'testController')).rejects.toThrow(
      "[HttpDispatcher Error]: The provided 'testController' does not implement the 'handle' method.",
    )
    expect(getServiceProxy).toHaveBeenCalledOnce()
  })

  it('returns a response directly when middleware does not invoke the handler', async () => {
    const handleController = vi.fn(
      async (_input: TestInput | undefined, _signal: AbortSignal | undefined) =>
        makeResponse('unused'),
    )
    const controller = { handle: handleController }
    const { dispatcher, getScope, getServiceProxy } = makeDispatcher({
      scope: {},
      controller,
      runMiddleware: false,
    })

    await expect(dispatcher.handle(makeRequest(), 'testController')).resolves.toMatchObject({
      status: 202,
      data: { data: 'skipped' },
    })
    expect(getScope).not.toHaveBeenCalled()
    expect(getServiceProxy).not.toHaveBeenCalled()
    expect(handleController).not.toHaveBeenCalled()
  })
})

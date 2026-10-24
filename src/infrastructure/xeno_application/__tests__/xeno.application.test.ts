import type {
  Identity,
  RequestContext,
  ResponseDto,
  XenoIncomingRequest,
  XenoRequest,
} from '@xeno-js/shared'
import type {
  IRequestContext,
  IServiceContainer,
  NativeListenOptions,
  XenoRegistry,
} from '@xeno-js/shared'
import { GUEST } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { XenoApplication } from '../xeno.application'

function makeContainer(dependencies: Map<string, unknown>) {
  const resolve = vi.fn((token: string) => dependencies.get(token))
  return { container: { resolve } as unknown as IServiceContainer, resolve }
}

function makeRequestContext(scope: object | undefined) {
  const getScope = vi.fn(() => scope)
  const runAsync = vi.fn(async (_context: RequestContext, operation: () => Promise<unknown>) =>
    operation(),
  )
  const context = { getScope, runAsync } as unknown as IRequestContext<RequestContext>
  return { context, getScope, runAsync }
}

describe('XenoApplication', () => {
  describe('getServices', () => {
    it('returns the services proxy for the active scope', () => {
      const scope = { id: 'scope-1' }
      const services = { users: { find: vi.fn() } }
      const getServiceProxy = vi.fn(() => services)
      const requestContext = makeRequestContext(scope)
      const { container, resolve } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.REQUEST_CONTEXT, requestContext.context],
          [TOKENS.SERVICE_PROXY, { getServiceProxy }],
        ]),
      )
      const application = new XenoApplication(container)

      expect(application.getScopedServices()).toBe(services)
      expect(resolve).toHaveBeenNthCalledWith(1, TOKENS.SERVICE_PROXY)
      expect(resolve).toHaveBeenNthCalledWith(2, TOKENS.REQUEST_CONTEXT)
      expect(requestContext.getScope).toHaveBeenCalledOnce()
      expect(getServiceProxy).toHaveBeenCalledWith(scope)
    })

    it('throws an actionable error when there is no active scope', () => {
      const getServiceProxy = vi.fn()
      const requestContext = makeRequestContext(undefined)
      const { container } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.REQUEST_CONTEXT, requestContext.context],
          [TOKENS.SERVICE_PROXY, { getServiceProxy }],
        ]),
      )
      const application = new XenoApplication(container)

      expect(() => application.getScopedServices()).toThrow('errors.not_found')
      expect(getServiceProxy).not.toHaveBeenCalled()
    })
  })

  describe('runInScope', () => {
    it('builds a guest context with generated network and tracing data by default', async () => {
      const scope = { id: 'scope-1' }
      const services = { tasks: { run: vi.fn() } }
      const getServiceProxy = vi.fn(() => services)
      const requestContext = makeRequestContext(scope)
      const { container, resolve } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.REQUEST_CONTEXT, requestContext.context],
          [TOKENS.SERVICE_PROXY, { getServiceProxy }],
        ]),
      )
      const application = new XenoApplication(container)
      const result = await application.runInScope(async (receivedServices) => {
        expect(receivedServices).toBe(services)
        return 'completed'
      })

      const syntheticContext = requestContext.runAsync.mock.calls[0][0]
      expect(result).toBe('completed')
      expect(syntheticContext.identity).toBe(GUEST)
      expect(syntheticContext.network).toMatchObject({
        clientIp: '127.0.0.1',
        path: 'internal://scope-runner',
        formatIndicator: 'application/json',
      })
      expect(typeof syntheticContext.network?.requestId).toBe('string')
      expect(typeof syntheticContext.tracing?.correlationId).toBe('string')
      expect(typeof syntheticContext.tracing?.spanId).toBe('string')
      expect(typeof syntheticContext.tracing?.startTime).toBe('number')
      expect(syntheticContext.messaging).toBeUndefined()
      expect(requestContext.runAsync).toHaveBeenCalledOnce()
      expect(getServiceProxy).toHaveBeenCalledWith(scope)
      expect(resolve).toHaveBeenNthCalledWith(1, TOKENS.REQUEST_CONTEXT)
      expect(resolve).toHaveBeenNthCalledWith(2, TOKENS.SERVICE_PROXY)
    })

    it('uses the provided context values and resolves services inside the scope', async () => {
      const scope = { id: 'scope-2' }
      const services = { reports: { list: vi.fn() } }
      const getServiceProxy = vi.fn(() => services)
      const requestContext = makeRequestContext(scope)
      const { container } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.REQUEST_CONTEXT, requestContext.context],
          [TOKENS.SERVICE_PROXY, { getServiceProxy }],
        ]),
      )
      const application = new XenoApplication(container)
      const identity: Identity = { userId: '11111111-1111-4111-8111-111111111111' }
      const network = { path: '/custom', clientIp: '192.0.2.1' } as RequestContext['network']
      const tracing: NonNullable<RequestContext['tracing']> = {
        correlationId: '22222222-2222-4222-8222-222222222222',
        startTime: Date.now(),
      }
      const messaging = { messageId: 'message-1' } as RequestContext['messaging']
      const ctx = { identity, network, tracing, messaging }

      await application.runInScope(async () => 'done', ctx)

      expect(requestContext.runAsync.mock.calls[0][0]).toEqual(ctx)
      expect(getServiceProxy).toHaveBeenCalledWith(scope)
    })

    it('propagates errors from the supplied operation', async () => {
      const requestContext = makeRequestContext({ id: 'scope-1' })
      const { container } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.REQUEST_CONTEXT, requestContext.context],
          [TOKENS.SERVICE_PROXY, { getServiceProxy: vi.fn(() => ({})) }],
        ]),
      )
      const application = new XenoApplication(container)
      const error = new Error('operation failed')

      await expect(
        application.runInScope(async () => {
          throw error
        }),
      ).rejects.toBe(error)
    })
  })

  describe('handle', () => {
    it('adapts the incoming request and dispatches it with the controller token and input', async () => {
      const incomingRequest: XenoIncomingRequest = {
        method: 'GET',
        url: '/users',
        headers: new Headers(),
        path: '/users',
      }
      const extendedRequest: XenoRequest = Object.assign(new Request('http://localhost/users'), {
        path: '/users',
      })
      const token = 'usersController' as keyof XenoRegistry
      const input = { userId: 'user-1' }
      const response = {
        status: 200,
        ok: true,
        headers: {},
        data: { success: true, data: { name: 'Ada' }, meta: {} },
      } satisfies ResponseDto<{ name: string }>
      const adapt = vi.fn(() => extendedRequest)
      const handle = vi.fn(async () => response)
      const info = vi.fn((value) => console.info(value))
      const { container } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.HTTP_ADAPTER, { adapt }],
          [TOKENS.HTTP_DISPATCHER, { handle }],
          [TOKENS.LOGGER, { info }],
        ]),
      )
      const application = new XenoApplication(container)

      await expect(application.handle(incomingRequest, token, input)).resolves.toBe(response)
      expect(adapt).toHaveBeenCalledWith(incomingRequest)
      expect(handle).toHaveBeenCalledWith(extendedRequest, token, input)
    })

    it('propagates adapter errors', async () => {
      const error = new Error('request cannot be adapted')
      const adapt = vi.fn(() => {
        throw error
      })
      const handle = vi.fn()
      const { container } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.HTTP_ADAPTER, { adapt }],
          [TOKENS.HTTP_DISPATCHER, { handle }],
        ]),
      )
      const application = new XenoApplication(container)

      await expect(
        application.handle({} as XenoIncomingRequest, 'controller' as keyof XenoRegistry),
      ).rejects.toBe(error)
      expect(handle).not.toHaveBeenCalled()
    })
  })

  describe('listen', () => {
    it('creates server options and starts the server with them', async () => {
      const options: NativeListenOptions = { port: 8080, host: '127.0.0.1' }
      const serverOptions = { port: 8080, host: '0.0.0.0' }
      const create = vi.fn(() => serverOptions)
      const listen = vi.fn(async () => 'listening')
      const { container, resolve } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.HTTP_SERVER, { listen }],
          [TOKENS.SERVER_OPTIONS_FACTORY, { create }],
        ]),
      )
      const application = new XenoApplication(container)

      await expect(application.listen(options)).resolves.toBe('listening')
      expect(resolve).toHaveBeenNthCalledWith(1, TOKENS.HTTP_SERVER)
      expect(resolve).toHaveBeenNthCalledWith(2, TOKENS.SERVER_OPTIONS_FACTORY)
      expect(create).toHaveBeenCalledWith(options)
      expect(listen).toHaveBeenCalledWith(serverOptions)
    })

    it('passes undefined options through the options factory', async () => {
      const create = vi.fn((options?: NativeListenOptions) => options ?? { port: 3000 })
      const listen = vi.fn(async () => undefined)
      const { container } = makeContainer(
        new Map<string, unknown>([
          [TOKENS.HTTP_SERVER, { listen }],
          [TOKENS.SERVER_OPTIONS_FACTORY, { create }],
        ]),
      )
      const application = new XenoApplication(container)

      await expect(application.listen()).resolves.toBeUndefined()
      expect(create).toHaveBeenCalledWith(undefined)
      expect(listen).toHaveBeenCalledWith({ port: 3000 })
    })
  })
})

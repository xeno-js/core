import type { AsyncLocalStorage } from 'node:async_hooks'

import type { Identity, IFactory, RequestContext } from '@xeno-js/shared'
import type { Guid } from '@xeno-js/shared'
import type { ExecutionContext, IServiceScope, XenoRegistry } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { NodeRequestContext } from '../request-context'

function makeStorage() {
  const runMock = vi.fn()
  const getStoreMock = vi.fn()

  const storage = {
    run: runMock,
    getStore: getStoreMock,
  } as unknown as AsyncLocalStorage<ExecutionContext<XenoRegistry>>

  return {
    storage,
    mocks: {
      runMock,
      getStoreMock,
    },
  }
}

function makeFactoryScope() {
  const disposeMock = vi.fn()
  const scope = { resolve: vi.fn(), dispose: disposeMock }
  const createMock = vi.fn().mockReturnValue(scope)

  const factoryScope = {
    create: createMock,
  } as unknown as IFactory<void, IServiceScope<XenoRegistry>>

  return {
    factoryScope,
    scope: scope as unknown as IServiceScope<XenoRegistry>,
    mocks: {
      createMock,
      disposeMock,
    },
  }
}

function makeRequestContext(): RequestContext {
  return {
    identity: {
      userId: 'u1' as unknown as Guid,
      email: 'admin@example.com',
      name: 'admin',
      tenantId: 't1' as unknown as Guid,
      roles: ['admin'],
      permissions: ['read'],
    },
    network: {
      requestId: 'r1' as unknown as Guid,
      clientIp: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
      formatIndicator: 'json',
      path: '/api/test',
      csrf: '',
      csrfCookie: '',
      origin: '',
    },
    tracing: {
      correlationId: 'c1' as unknown as Guid,
      startTime: Date.now(),
      spanId: 's1',
      parentSpanId: 'ps1',
    },
    messaging: undefined,
  }
}

describe('NodeRequestContext', () => {
  it('runAsync delegates to AsyncLocalStorage.run, returns its result and disposes the scope', async () => {
    const { storage, mocks } = makeStorage()
    const context = makeRequestContext()
    const { factoryScope, mocks: scopeMocks } = makeFactoryScope()
    mocks.runMock.mockImplementation((_store, fn: () => Promise<string>) => fn())

    const requestContext = new NodeRequestContext(storage, factoryScope)
    const result = await requestContext.runAsync(context, async () => 'ok')

    expect(result).toBe('ok')
    expect(mocks.runMock).toHaveBeenCalledOnce()
    expect(mocks.runMock).toHaveBeenCalledWith(
      expect.objectContaining({ context }),
      expect.any(Function),
    )
    expect(scopeMocks.createMock).toHaveBeenCalledOnce()
    expect(scopeMocks.disposeMock).toHaveBeenCalledOnce()
  })

  it('runAsync disposes the scope and propagates errors from the callback', async () => {
    const { storage, mocks } = makeStorage()
    const { factoryScope, mocks: scopeMocks } = makeFactoryScope()
    const callbackError = new Error('callback failed')
    mocks.runMock.mockImplementation((_store, fn: () => Promise<never>) => fn())
    const requestContext = new NodeRequestContext(storage, factoryScope)

    await expect(
      requestContext.runAsync(makeRequestContext(), async () => Promise.reject(callbackError)),
    ).rejects.toBe(callbackError)

    expect(scopeMocks.disposeMock).toHaveBeenCalledOnce()
  })

  it('getContext returns undefined when store is undefined or null', () => {
    const { storage, mocks } = makeStorage()
    const requestContext = new NodeRequestContext(storage, makeFactoryScope().factoryScope)

    mocks.getStoreMock.mockReturnValue(undefined)
    expect(requestContext.getContext()).toBeUndefined()

    mocks.getStoreMock.mockReturnValue(null)
    expect(requestContext.getContext()).toBeUndefined()
  })

  it('getContext returns and freezes the context when a store exists', () => {
    const { storage, mocks } = makeStorage()
    const original = makeRequestContext()
    mocks.getStoreMock.mockReturnValue({ context: original, scope: {} })

    const requestContext = new NodeRequestContext(storage, makeFactoryScope().factoryScope)
    const result = requestContext.getContext()

    expect(result).toBe(original)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('updateIdentity does nothing without a store or context', () => {
    const { storage, mocks } = makeStorage()
    const requestContext = new NodeRequestContext(storage, makeFactoryScope().factoryScope)
    const identity = makeRequestContext().identity

    mocks.getStoreMock.mockReturnValue(undefined)
    expect(() => requestContext.updateIdentity(identity)).not.toThrow()

    const store = { context: undefined, scope: {} }
    mocks.getStoreMock.mockReturnValue(store)
    expect(() => requestContext.updateIdentity(identity)).not.toThrow()
    expect(store.context).toBeUndefined()
  })

  it('updateIdentity replaces the context with frozen copies including the new identity', () => {
    const { storage, mocks } = makeStorage()
    const original = makeRequestContext()
    const store = { context: original, scope: {} }
    mocks.getStoreMock.mockReturnValue(store)
    const requestContext = new NodeRequestContext(storage, makeFactoryScope().factoryScope)
    const identity = { ...makeRequestContext().identity, userId: 'u2' as Guid } as Identity

    requestContext.updateIdentity(identity)

    expect(store.context).not.toBe(original)
    expect(store.context?.identity).toBe(identity)
    expect(Object.isFrozen(store.context)).toBe(true)
    expect(Object.isFrozen(store.context?.identity)).toBe(true)
    expect(original.identity?.userId).toBe('u1')
  })

  it('getIdentity returns undefined without a store and a frozen identity within a store', () => {
    const { storage, mocks } = makeStorage()
    const requestContext = new NodeRequestContext(storage, makeFactoryScope().factoryScope)

    mocks.getStoreMock.mockReturnValue(undefined)
    expect(requestContext.getIdentity()).toBeUndefined()

    const identity = makeRequestContext().identity
    mocks.getStoreMock.mockReturnValue({ context: { identity }, scope: {} })
    const result = requestContext.getIdentity()

    expect(result).toBe(identity)
    expect(Object.isFrozen(result)).toBe(true)
  })

  it('getScope returns undefined without a store and the active scope when available', () => {
    const { storage, mocks } = makeStorage()
    const { scope, factoryScope } = makeFactoryScope()
    const requestContext = new NodeRequestContext(storage, factoryScope)

    mocks.getStoreMock.mockReturnValue(undefined)
    expect(requestContext.getScope()).toBeUndefined()

    mocks.getStoreMock.mockReturnValue({ context: makeRequestContext(), scope })
    expect(requestContext.getScope()).toBe(scope)
  })

  it('getNetworkContext returns undefined without a store and a frozen network context when available', () => {
    const { storage, mocks } = makeStorage()
    const requestContext = new NodeRequestContext(storage, makeFactoryScope().factoryScope)

    mocks.getStoreMock.mockReturnValue(undefined)
    expect(requestContext.getNetworkContext()).toBeUndefined()

    const network = makeRequestContext().network
    mocks.getStoreMock.mockReturnValue({ context: { network }, scope: {} })
    const result = requestContext.getNetworkContext()

    expect(result).toBe(network)
    expect(Object.isFrozen(result)).toBe(true)
  })
})

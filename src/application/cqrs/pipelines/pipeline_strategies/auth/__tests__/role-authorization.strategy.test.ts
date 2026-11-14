import type { IContextAccessor, IPolicyRegistry, IRequest, RequestContext } from '@xeno-js/shared'
import { type AuthPolicy } from '@xeno-js/shared'
import { ERROR_CODES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import { RoleAuthorizationStrategy } from '../role-authorization.strategy'

const makeRequest = (intent = 'TestCommand'): IRequest =>
  ({ intent, type: 'COMMAND', signal: undefined }) as unknown as IRequest

const makeRequestContext = (identity?: { roles?: string[] }): IContextAccessor<RequestContext> => ({
  getContext: vi.fn().mockReturnValue({
    identity: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      roles: identity?.roles ?? [],
      permissions: [],
    },
    network: { requestId: 'req-1' },
    tracing: {},
  }),
})

const makePolicy = (overrides?: Partial<AuthPolicy>): AuthPolicy => ({
  userId: false,
  tenantId: false,
  roles: [],
  permissions: [],
  ...overrides,
})

const makePolicyRegistry = (
  policy?: AuthPolicy,
  superadminPolicy?: AuthPolicy,
): { registry: IPolicyRegistry; getPolicyMock: Mock } => {
  const getPolicyMock = vi.fn((intent: string) =>
    intent === 'superadmin' ? superadminPolicy : policy,
  )
  const registry = {
    getPolicy: getPolicyMock,
    addPolicy: vi.fn(),
  } as unknown as IPolicyRegistry
  return { registry, getPolicyMock }
}

describe('RoleAuthorizationStrategy', () => {
  let request: IRequest

  beforeEach(() => {
    request = makeRequest()
  })

  describe('execute � context guard (from base class)', () => {
    it('returns UNAUTHORIZED when getContext returns undefined', async () => {
      const requestContext = {
        getContext: vi.fn().mockReturnValue(undefined),
      } as unknown as IContextAccessor<RequestContext>
      const { registry } = makePolicyRegistry(makePolicy())
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.UNAUTHORIZED)
    })

    it('returns UNAUTHORIZED when getContext returns null', async () => {
      const requestContext = {
        getContext: vi.fn().mockReturnValue(null),
      } as unknown as IContextAccessor<RequestContext>
      const { registry } = makePolicyRegistry(makePolicy())
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.UNAUTHORIZED)
    })
  })

  describe('performAuthorizationCheck � no policy found', () => {
    it('returns true when policy is undefined', async () => {
      const requestContext = makeRequestContext()
      const { registry } = makePolicyRegistry(undefined)
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(true)
    })
  })

  describe('performAuthorizationCheck � policy with empty permissions (role check skipped)', () => {
    it('returns ok when policy has empty permissions array', async () => {
      const requestContext = makeRequestContext({ roles: ['admin'] })
      const { registry } = makePolicyRegistry(makePolicy({ permissions: [], roles: ['admin'] }))
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(true)
    })
  })

  describe('performAuthorizationCheck � role checks (triggered when permissions is non-empty)', () => {
    it('returns ok when user has at least one required role', async () => {
      const requestContext = makeRequestContext({ roles: ['admin', 'viewer'] })
      const { registry } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: ['admin', 'superuser'] }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(true)
    })

    it('returns AUTH_FORBIDDEN when user has none of the required roles', async () => {
      const requestContext = makeRequestContext({ roles: ['viewer'] })
      const { registry } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: ['admin', 'superuser'] }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.FORBIDDEN)
    })

    it('returns AUTH_FORBIDDEN when user roles are undefined', async () => {
      const requestContext = makeRequestContext({ roles: undefined })
      const { registry } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: ['admin'] }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.FORBIDDEN)
    })

    it('returns AUTH_FORBIDDEN when user role casing does not match lowercased policy role', async () => {
      // user role 'ADMIN' does NOT match policy role 'admin'.toLowerCase() === 'admin'
      // because 'ADMIN'.includes('admin') is false
      const requestContext = makeRequestContext({ roles: ['ADMIN'] })
      const { registry } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: ['admin'] }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.FORBIDDEN)
    })

    it('returns true when policy roles array is empty', async () => {
      const requestContext = makeRequestContext({ roles: ['admin'] })
      const { registry } = makePolicyRegistry(makePolicy({ permissions: ['read'], roles: [] }))
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(true)
    })

    it('returns true when policy roles is undefined', async () => {
      const requestContext = makeRequestContext({ roles: ['admin'] })
      const { registry } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: undefined }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(true)
    })

    it('calls getPolicy with the correct intent', async () => {
      const requestContext = makeRequestContext({ roles: ['admin'] })
      const { registry, getPolicyMock } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: ['admin'] }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      await strategy.execute(request)

      expect(getPolicyMock).toHaveBeenCalledTimes(2)
      expect(getPolicyMock).toHaveBeenNthCalledWith(1, 'superadmin')
      expect(getPolicyMock).toHaveBeenNthCalledWith(2, 'TestCommand')
    })
  })

  describe('execute — superadmin bypass', () => {
    it('returns ok when user has a superadmin role not listed in the command roles', async () => {
      const requestContext = makeRequestContext({ roles: ['root'] })
      const { registry } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: ['admin'] }),
        makePolicy({ roles: ['root'] }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(true)
    })

    it('falls back to the command role check when user is not a superadmin', async () => {
      const requestContext = makeRequestContext({ roles: ['viewer'] })
      const { registry, getPolicyMock } = makePolicyRegistry(
        makePolicy({ permissions: ['read'], roles: ['admin'] }),
        makePolicy({ roles: ['root'] }),
      )
      const strategy = new RoleAuthorizationStrategy(registry, requestContext)

      const result = await strategy.execute(request)

      expect(result.isOk()).toBe(false)
      expect(result.getErrorOrThrow().code).toBe(ERROR_CODES.FORBIDDEN)
      expect(getPolicyMock).toHaveBeenCalledWith('TestCommand')
    })
  })
})

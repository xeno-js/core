import type {
  Guid,
  IContextAccessor,
  NetworkContext,
  RequestContext,
  XenoRequest,
} from '@xeno-js/shared'
import type { ICsrfTokenService, MiddlewareConfig } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CsrfCookieMiddleware } from '../csrf-cookie.middleware'

const headers: Request['headers'] = new Headers({ Authorization: 'Bearer tok' })
const path = '/api/test'
const method = 'GET'
const transport = {
  req: {
    path,
    method,
    headers,
  } as unknown as XenoRequest,
}

function makeMiddleware(
  contextData: Partial<RequestContext> | undefined = {
    network: {
      csrf: 'valid-token',
      csrfCookie: 'valid-token',
      formatIndicator: 'application/json',
    } as unknown as NetworkContext,
    identity: {
      userId: 'user-123' as Guid,
      tenantId: '123' as Guid,
      roles: [],
      permissions: [],
      email: 'admin@admin.com',
      name: 'admin',
    },
  },
  csrfConfig: NonNullable<MiddlewareConfig['csrf']> = {
    secret: 'valid-secret',
    cookieName: 'csrf-token',
    cookieMaxAgeSeconds: 3600,
    headerName: 'x-csrf-token',
  },
  generatedToken = 'generated-csrf-token',
) {
  const getContext = vi.fn().mockReturnValue(contextData)
  const requestContext = { getContext } as unknown as IContextAccessor<RequestContext>

  const generate = vi.fn().mockResolvedValue(generatedToken)
  const csrfTokenService = { generate } as unknown as ICsrfTokenService

  const middleware = new CsrfCookieMiddleware(requestContext, csrfTokenService, csrfConfig)

  return { middleware, generate, getContext }
}

describe('CsrfCookieMiddleware', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('returns response without generating cookie when user is not authenticated (missing userId)', async () => {
    const { middleware, generate } = makeMiddleware({
      network: {
        csrf: 'valid-token',
        csrfCookie: undefined,
        formatIndicator: 'application/json',
      } as unknown as NetworkContext,
      identity: {
        userId: undefined,
        tenantId: '123' as Guid,
        roles: [],
        permissions: [],
        email: 'admin@admin.com',
        name: 'admin',
      },
    })
    const next = vi.fn().mockResolvedValue({ status: 200, ok: true, headers: {}, data: {} })

    const response = await middleware.execute(transport.req, next)

    expect(response.ok).toBe(true)
    expect(generate).not.toHaveBeenCalled()
    expect(response.headers?.['Set-Cookie']).toBeUndefined()
  })

  it('returns response without generating cookie when csrfCookie is already present in network context', async () => {
    const { middleware, generate } = makeMiddleware({
      network: {
        csrf: 'valid-token',
        csrfCookie: 'existing-cookie',
        formatIndicator: 'application/json',
      } as unknown as NetworkContext,
      identity: {
        userId: 'user-123' as Guid,
        tenantId: '123' as Guid,
        roles: [],
        permissions: [],
        email: 'admin@admin.com',
        name: 'admin',
      },
    })
    const next = vi.fn().mockResolvedValue({ status: 200, ok: true, headers: {}, data: {} })

    const response = await middleware.execute(transport.req, next)

    expect(response.ok).toBe(true)
    expect(generate).not.toHaveBeenCalled()
    expect(response.headers?.['Set-Cookie']).toBeUndefined()
  })

  it('generates CSRF token and sets default cookie when user is authenticated and cookie is missing', async () => {
    const { middleware, generate } = makeMiddleware(
      {
        network: {
          csrf: 'valid-token',
          csrfCookie: undefined,
          formatIndicator: 'application/json',
        } as unknown as NetworkContext,
        identity: {
          userId: 'user-123' as Guid,
          tenantId: '123' as Guid,
          roles: [],
          permissions: [],
          email: 'admin@admin.com',
          name: 'admin',
        },
      },
      {
        secret: 'valid-secret',
        cookieName: 'csrf-token',
        cookieMaxAgeSeconds: 3600,
        headerName: 'x-csrf-token',
      },
      'my-secret-token',
    )
    const next = vi.fn().mockResolvedValue({ status: 200, ok: true, headers: {}, data: {} })

    const response = await middleware.execute(transport.req, next)

    expect(response.ok).toBe(true)
    expect(generate).toHaveBeenCalledOnce()
    expect(generate).toHaveBeenCalledWith('user-123')

    const setCookieHeaders = response.headers?.['Set-Cookie'] as string[]
    expect(setCookieHeaders).toBeDefined()
    expect(setCookieHeaders).toHaveLength(1)
    expect(setCookieHeaders[0]).toContain(
      'csrf-token=my-secret-token; Path=/; Secure; SameSite=lax; Max-Age=3600',
    )
    expect(setCookieHeaders[0]).toContain('Path=/')
    expect(setCookieHeaders[0]).toContain('Secure')
    expect(setCookieHeaders[0]).toContain('SameSite=lax')
    expect(setCookieHeaders[0]).toContain('Max-Age=3600')
  })

  it('respects custom configuration for cookie name, max age, and sameSite policy', async () => {
    const { middleware } = makeMiddleware(
      {
        network: {
          csrf: 'valid-token',
          csrfCookie: undefined,
          formatIndicator: 'application/json',
        } as unknown as NetworkContext,
        identity: {
          userId: 'user-123' as Guid,
          tenantId: '123' as Guid,
          roles: [],
          permissions: [],
          email: 'admin@admin.com',
          name: 'admin',
        },
      },
      {
        secret: 'valid-secret',
        cookieName: 'custom_csrf',
        cookieMaxAgeSeconds: 7200,
        headerName: 'x-csrf-token',
        sameSite: 'strict',
      },
      'custom-token',
    )
    const next = vi.fn().mockResolvedValue({ status: 200, ok: true, headers: {}, data: {} })

    const response = await middleware.execute(transport.req, next)

    const setCookieHeaders = response.headers?.['Set-Cookie'] as string[]
    expect(setCookieHeaders[0]).toContain('custom_csrf=custom-token')
    expect(setCookieHeaders[0]).toContain('SameSite=strict')
    expect(setCookieHeaders[0]).toContain('Max-Age=7200')
  })

  it('appends the new CSRF cookie preserving any existing Set-Cookie headers', async () => {
    const { middleware } = makeMiddleware(
      {
        network: {
          csrf: 'valid-token',
          csrfCookie: undefined,
          formatIndicator: 'application/json',
        } as unknown as NetworkContext,
        identity: {
          userId: 'user-123' as Guid,
          tenantId: '123' as Guid,
          roles: [],
          permissions: [],
          email: 'admin@admin.com',
          name: 'admin',
        },
      },
      {
        secret: 'valid-secret',
        cookieName: 'custom_csrf',
        cookieMaxAgeSeconds: 7200,
        headerName: 'x-csrf-token',
        sameSite: 'strict',
      },
      'new-token',
    )
    const next = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: {
        'Set-Cookie': ['session=active'],
      },
      data: {},
    })

    const response = await middleware.execute(transport.req, next)

    const setCookieHeaders = response.headers?.['Set-Cookie'] as string[]
    expect(setCookieHeaders).toHaveLength(2)
    expect(setCookieHeaders).toEqual([
      'session=active',
      expect.stringContaining(
        'custom_csrf=new-token; Path=/; Secure; SameSite=strict; Max-Age=7200',
      ),
    ])
  })
  it('uses default cookie settings and encodes the generated token when response headers are absent', async () => {
    const { middleware, generate, getContext } = makeMiddleware(
      {
        identity: {
          userId: 'user-123' as Guid,
          tenantId: '123' as Guid,
          roles: [],
          permissions: [],
          email: 'admin@admin.com',
          name: 'admin',
        },
      },
      { secret: 'valid-secret' },
      'token+/value',
    )
    const response = { status: 200, ok: true, data: {} }
    const next = vi.fn().mockResolvedValue(response)

    const result = await middleware.execute(transport.req, next)

    expect(next).toHaveBeenCalledOnce()
    expect(getContext).toHaveBeenCalledOnce()
    expect(generate).toHaveBeenCalledWith('user-123')
    expect(result).toBe(response)
    expect(result.headers?.['Set-Cookie']).toEqual([
      '__Host-xeno-csrf=token%2B%2Fvalue; Path=/; Secure; SameSite=lax; Max-Age=3600',
    ])
  })

  it('returns the response without generating a token when the request context is missing', async () => {
    const { middleware, generate, getContext } = makeMiddleware(undefined)
    const response = { status: 200, ok: true, headers: {}, data: {} }
    const next = vi.fn().mockResolvedValue(response)

    const result = await middleware.execute(transport.req, next)

    expect(result).toBe(response)
    expect(next).toHaveBeenCalledOnce()
    expect(getContext).toHaveBeenCalledOnce()
    expect(generate).not.toHaveBeenCalled()
    expect(result.headers?.['Set-Cookie']).toBeUndefined()
  })
})

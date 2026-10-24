import type {
  HttpMethod,
  NativeRouteDefinition,
  RouteHandlerContext,
  RoutePolicy,
  XenoRegistry,
} from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { guards, routePatternHelper, httpHelper, statusCodes } = vi.hoisted(() => ({
  guards: {
    isNullOrEmpty: vi.fn((value: unknown) => value === undefined || value === null || value === ''),
    isDefined: vi.fn((value: unknown) => value !== undefined && value !== null),
  },
  routePatternHelper: {
    normalizePath: vi.fn((path: string) => {
      const normalized = path.trim().replace(/\/+$/, '')
      return normalized.startsWith('/') ? normalized : `/${normalized}`
    }),
  },
  httpHelper: {
    parseSafeUrl: vi.fn((url: string) => new URL(url, 'http://localhost')),
  },
  statusCodes: { NO_CONTENT: 204 },
}))

vi.mock('@xeno-js/shared', () => ({
  Guards: guards,
  HttpHelper: httpHelper,
  RoutePatternHelper: routePatternHelper,
  STATUS_CODES: statusCodes,
}))

import { RouteMatcher } from '../route-matcher.http'

type Registry = XenoRegistry<unknown, unknown, { users: string; health: string }>

interface CompiledRoute {
  definition: NativeRouteDefinition<Registry>
  pattern: RegExp
  upperMethod: string
}

function makeRoute(
  path: string,
  method: HttpMethod,
  security?: RoutePolicy,
): NativeRouteDefinition<Registry> {
  return {
    path,
    method,
    security,
    handler: async <TOutput>() => ({
      status: 200,
      ok: true,
      headers: {},
      data: { success: true, data: undefined as TOutput, meta: {} },
    }),
  }
}

function compileRoute(
  path: string,
  method: HttpMethod,
  pattern = new RegExp(`^${path}/?$`),
  security?: RoutePolicy,
): CompiledRoute {
  const definition = makeRoute(path, method, security)
  return { definition, pattern, upperMethod: method.toUpperCase() }
}

describe('RouteMatcher', () => {
  beforeEach(() => vi.clearAllMocks())

  it('normalizes URLs, methods, and paths before matching dynamic routes', () => {
    const route = compileRoute('/users/:id', 'GET', /^\/users\/[^/]+\/?$/)
    const matcher = new RouteMatcher<Registry>([route])

    expect(matcher.match('http://localhost/users/42?include=posts', 'get')).toBe(route.definition)
    expect(httpHelper.parseSafeUrl).toHaveBeenCalledWith('http://localhost/users/42?include=posts')
    expect(routePatternHelper.normalizePath).toHaveBeenCalledWith('/users/42')
    expect(matcher.match('/users/42/', 'GET')).toBe(route.definition)
  })

  it.each([undefined, null, ''])('maps an empty URL (%s) to the root path', (url) => {
    const rootRoute = compileRoute('/', 'GET', /^\/?$/)
    const matcher = new RouteMatcher<Registry>([rootRoute])

    expect(matcher.match(url!, 'GET')).toBe(rootRoute.definition)
    expect(guards.isNullOrEmpty).toHaveBeenCalledWith(url)
    expect(httpHelper.parseSafeUrl).toHaveBeenCalledWith('/')
  })

  it('returns undefined when no route matches the path or method', () => {
    const matcher = new RouteMatcher<Registry>([
      compileRoute('/users/:id', 'GET', /^\/users\/[^/]+\/?$/),
      compileRoute('/health', 'GET', /^\/health\/?$/),
    ])

    expect(matcher.match('/users', 'GET')).toBeUndefined()
    expect(matcher.match('/users/42', 'POST')).toBeUndefined()
    expect(matcher.match('/missing', 'GET')).toBeUndefined()
  })

  it('returns the first matching route when duplicate definitions exist', () => {
    const first = compileRoute('/health', 'GET', /^\/health\/?$/)
    const second = compileRoute('/health', 'GET', /^\/health\/?$/)
    const matcher = new RouteMatcher<Registry>([first, second])

    expect(matcher.match('/health', 'GET')).toBe(first.definition)
  })

  it('creates a no-content OPTIONS route and handles successful preflight dispatch', async () => {
    const matcher = new RouteMatcher<Registry>([compileRoute('/health', 'GET', /^\/health\/?$/)])
    const optionsRoute = matcher.match('/health', 'OPTIONS')
    const handle = vi.fn().mockResolvedValue({ status: 200, data: 'handled' })

    expect(optionsRoute).toBeDefined()
    expect(optionsRoute?.method).toBe('OPTIONS')
    expect(optionsRoute?.path).toBe('/health')
    await expect(
      optionsRoute?.handler({ handle } as unknown as RouteHandlerContext<Registry>),
    ).resolves.toEqual({ status: 200, data: 'handled' })
    expect(handle).toHaveBeenCalledWith('__PREFLIGHT__')
  })

  it('returns a no-content response when preflight dispatch rejects', async () => {
    const matcher = new RouteMatcher<Registry>([compileRoute('/health', 'GET', /^\/health\/?$/)])
    const optionsRoute = matcher.match('/health', 'OPTIONS')
    const handle = vi.fn().mockRejectedValue(new Error('No preflight handler'))

    expect(optionsRoute).toBeDefined()
    await expect(
      optionsRoute?.handler({ handle } as unknown as RouteHandlerContext<Registry>),
    ).resolves.toMatchObject({
      status: 204,
      ok: true,
      headers: {},
      data: undefined,
    })
    expect(handle).toHaveBeenCalledWith('__PREFLIGHT__')
  })

  it('does not create an OPTIONS route for an unknown path', () => {
    const matcher = new RouteMatcher<Registry>([compileRoute('/health', 'GET', /^\/health\/?$/)])

    expect(matcher.match('/missing', 'OPTIONS')).toBeUndefined()
  })

  it('returns the matched route policy', () => {
    const security: RoutePolicy = {
      withCredentials: true,
      allowOrigins: ['https://app.example.com'],
      withCsrf: false,
      withCors: true,
    }
    const route = compileRoute('/users/:id', 'GET', /^\/users\/[^/]+\/?$/, security)
    const matcher = new RouteMatcher<Registry>([route])

    expect(matcher.checkRoutePolicy('/users/42', 'GET')).toEqual(security)
  })

  it('returns undefined policy values when the route has no security settings', () => {
    const route = compileRoute('/health', 'GET', /^\/health\/?$/)
    const matcher = new RouteMatcher<Registry>([route])

    expect(matcher.checkRoutePolicy('/health', 'GET')).toEqual({
      withCredentials: undefined,
      allowOrigins: undefined,
      withCsrf: undefined,
      withCors: undefined,
    })
  })

  it('returns undefined policy values when no route matches', () => {
    const matcher = new RouteMatcher<Registry>([])

    expect(matcher.checkRoutePolicy('/missing', 'GET')).toEqual({
      withCredentials: undefined,
      allowOrigins: undefined,
      withCsrf: undefined,
      withCors: undefined,
    })
  })

  it('propagates URL parsing errors', () => {
    const matcher = new RouteMatcher<Registry>([])
    const error = new Error('Invalid URL')
    httpHelper.parseSafeUrl.mockImplementationOnce(() => {
      throw error
    })

    expect(() => matcher.match('invalid-url', 'GET')).toThrow(error)
  })
})

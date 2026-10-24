import type { XenoRequest } from '@xeno-js/shared'
import { describe, expect, it } from 'vitest'

import { ClientIpResolver } from '../client-ip.resolver'

describe('ClientIpResolver', () => {
  it('returns undefined when there is no socket IP and no client IP', () => {
    const resolver = new ClientIpResolver()

    const req = {
      path: '/test',
      socket: undefined,
    } as XenoRequest
    expect(resolver.resolve(req, undefined)).toBeUndefined()
  })

  it('uses the first forwarded client IP when no socket IP is available', () => {
    const resolver = new ClientIpResolver()
    const req = {
      path: '/test',
      socket: undefined,
    } as XenoRequest
    expect(resolver.resolve(req, ' 203.0.113.9, 198.51.100.7 ')).toBe('203.0.113.9')
  })

  it('returns the socket IP when it is not trusted and a proxy is present', () => {
    const resolver = new ClientIpResolver(['10.0.0.2'])
    const req = {
      path: '/test',
      socket: { remoteAddress: '203.0.113.42' },
    } as XenoRequest
    expect(resolver.resolve(req, '198.51.100.1')).toBe('203.0.113.42')
  })

  it('prefers the forwarded client IP when the socket IP is a trusted proxy', () => {
    const resolver = new ClientIpResolver(['10.0.0.2'])
    const req = {
      path: '/test',
      socket: { remoteAddress: '10.0.0.2' },
    } as XenoRequest
    expect(resolver.resolve(req, ' 198.51.100.1, 10.0.0.9 ')).toBe('198.51.100.1')
  })

  it('falls back to the socket IP when a trusted proxy sends no forwarded client IP', () => {
    const resolver = new ClientIpResolver(['10.0.0.2'])
    const req = {
      path: '/test',
      socket: { remoteAddress: '10.0.0.2' },
    } as XenoRequest

    expect(resolver.resolve(req, undefined)).toBe('10.0.0.2')
  })
})

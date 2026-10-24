import type { RequestContext } from '@xeno-js/shared'
import type { ApplicationRegistry, IRequestContext } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { RateLimitKeyBuilder } from '../rate-limit-key-builder.cache'

function makeContextAccessor(input: { tenantId?: string; userId?: string; clientIp?: string }) {
  const contextAccessor = {
    getContext: vi.fn(() => ({
      identity: {
        tenantId: input.tenantId,
        userId: input.userId,
      },
      network: {
        clientIp: input.clientIp,
      },
    })),
  }

  return contextAccessor as unknown as IRequestContext<RequestContext, ApplicationRegistry<unknown>>
}

describe('RateLimitKeyBuilder', () => {
  it('builds a tenant-scoped key when both tenant and user are available', () => {
    const accessor = makeContextAccessor({
      tenantId: 'tenant-42',
      userId: 'user-7',
      clientIp: '10.0.0.1',
    })
    const builder = new RateLimitKeyBuilder(accessor)

    expect(builder.buildRateLimitKey('resource')).toBe(
      'ratelimit:tenant:tenant-42:user:user-7:resource',
    )
  })

  it('builds a tenant IP-scoped key when tenant and clientIp are available without a user', () => {
    const accessor = makeContextAccessor({ tenantId: 'tenant-42', clientIp: '10.0.0.1' })
    const builder = new RateLimitKeyBuilder(accessor)

    expect(builder.buildRateLimitKey('resource')).toBe(
      'ratelimit:tenant:tenant-42:ip:10.0.0.1:resource',
    )
  })

  it('builds a user-scoped key when userId is present but tenant is missing', () => {
    const accessor = makeContextAccessor({ userId: 'user-7', clientIp: '10.0.0.1' })
    const builder = new RateLimitKeyBuilder(accessor)

    expect(builder.buildRateLimitKey('resource')).toBe('ratelimit:user:user-7:resource')
  })

  it('builds an IP-scoped key when only the client IP is present', () => {
    const accessor = makeContextAccessor({ clientIp: '10.0.0.1' })
    const builder = new RateLimitKeyBuilder(accessor)

    expect(builder.buildRateLimitKey('resource')).toBe('ratelimit:ip:10.0.0.1:resource')
  })

  it('returns undefined when no identity or client IP data is available', () => {
    const accessor = makeContextAccessor({})
    const builder = new RateLimitKeyBuilder(accessor)

    expect(builder.buildRateLimitKey('resource')).toBeUndefined()
  })

  it('ignores empty strings when deciding the key scope', () => {
    const accessor = makeContextAccessor({ tenantId: '', userId: '', clientIp: '' })
    const builder = new RateLimitKeyBuilder(accessor)

    expect(builder.buildRateLimitKey('resource')).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'

import { InMemoryCache } from '../inmemory.cache'

describe('InMemoryCache', () => {
  it('creates a counter with value 1 when the key does not exist', async () => {
    const cache = new InMemoryCache()

    await expect(cache.increment('missing', 60)).resolves.toBe(1)
    await expect(cache.get<number>('missing')).resolves.toBe(1)
  })

  it('increments an existing value and stores the next count', async () => {
    const cache = new InMemoryCache()
    await cache.set('count', 4, 60)

    await expect(cache.increment('count', 60)).resolves.toBe(5)
    await expect(cache.get<number>('count')).resolves.toBe(5)
  })

  it('uses a default ttl when ttlSeconds is undefined', async () => {
    const cache = new InMemoryCache()
    await cache.set('count', 2, 60)

    await expect(cache.increment('count', undefined)).resolves.toBe(3)
    await expect(cache.get<number>('count')).resolves.toBe(3)
  })

  it('coerces the current value to a number before incrementing', async () => {
    const cache = new InMemoryCache()
    await cache.set('count', '9' as unknown as number, 60)

    await expect(cache.increment('count', 60)).resolves.toBe(10)
    await expect(cache.get<number>('count')).resolves.toBe(10)
  })

  it('returns the incremented value even when the stored value is NaN or invalid', async () => {
    const cache = new InMemoryCache()
    await cache.set('count', Number.NaN, 60)

    await expect(cache.increment('count', 60)).resolves.toBe(1)
    await expect(cache.get<number>('count')).resolves.toBe(1)
  })
})

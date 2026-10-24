import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InMemoryCache } from '../inmemory.cache'

describe('InMemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns undefined for missing keys in get', async () => {
    const cache = new InMemoryCache()

    await expect(cache.get('missing')).resolves.toBeUndefined()
  })

  it('stores and retrieves values without ttl', async () => {
    const cache = new InMemoryCache()
    const value = { user: 'alice', roles: ['admin'] }

    await cache.set('k1', value, undefined)

    await expect(cache.get<typeof value>('k1')).resolves.toEqual(value)
    await expect(cache.has('k1')).resolves.toBe(true)
  })

  it('expires entries based on ttl and deletes expired entries on get', async () => {
    const cache = new InMemoryCache()

    await cache.set('k-exp', { ok: true }, 1)
    await expect(cache.get<{ ok: boolean }>('k-exp')).resolves.toEqual({ ok: true })

    vi.advanceTimersByTime(1001)

    await expect(cache.get('k-exp')).resolves.toBeUndefined()
    await expect(cache.has('k-exp')).resolves.toBe(false)
  })

  it('setIfAbsent returns true and stores when key is absent', async () => {
    const cache = new InMemoryCache()

    await expect(cache.setIfAbsent('new-key', { n: 1 }, undefined)).resolves.toBe(true)
    await expect(cache.get<{ n: number }>('new-key')).resolves.toEqual({ n: 1 })
  })

  it('setIfAbsent returns false and does not overwrite existing value', async () => {
    const cache = new InMemoryCache()

    await cache.set('key', { n: 1 }, undefined)
    await expect(cache.setIfAbsent('key', { n: 2 }, undefined)).resolves.toBe(false)
    await expect(cache.get<{ n: number }>('key')).resolves.toEqual({ n: 1 })
  })

  it('remove deletes key and has returns false', async () => {
    const cache = new InMemoryCache()

    await cache.set('to-remove', { ok: true }, undefined)
    await cache.remove('to-remove')

    await expect(cache.has('to-remove')).resolves.toBe(false)
    await expect(cache.get('to-remove')).resolves.toBeUndefined()
  })

  it('clear removes all entries', async () => {
    const cache = new InMemoryCache()

    await cache.set('a', 1, undefined)
    await cache.set('b', 2, undefined)
    await cache.clear()

    await expect(cache.has('a')).resolves.toBe(false)
    await expect(cache.has('b')).resolves.toBe(false)
  })

  it('has returns false and evicts when key is expired', async () => {
    const cache = new InMemoryCache()

    await cache.set('ttl-key', { v: 1 }, 1)
    vi.advanceTimersByTime(1001)

    await expect(cache.has('ttl-key')).resolves.toBe(false)
    await expect(cache.get('ttl-key')).resolves.toBeUndefined()
  })

  it('serializes primitive values and returns parsed value in get', async () => {
    const cache = new InMemoryCache()

    await cache.set('num', 123, undefined)

    await expect(cache.get<number>('num')).resolves.toBe(123)
  })
})

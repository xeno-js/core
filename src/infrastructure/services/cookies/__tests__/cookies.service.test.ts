import type { IConfigurationService, INetworkContextAccessor } from '@xeno-js/shared'
import type { ISsrCookieToSet } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { CookieHandler } from '../cookies.service'

function makeHandler(
  context: { cookies?: string } | undefined,
  nodeEnv = 'development',
  defaultOptions?: Partial<ISsrCookieToSet>,
): CookieHandler {
  const contextAccessor = {
    getNetworkContext: vi.fn(() => context),
  } as unknown as INetworkContextAccessor
  const config = {
    get: vi.fn((key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined)),
  } as unknown as IConfigurationService

  return new CookieHandler(contextAccessor, config, defaultOptions)
}

describe('CookieHandler', () => {
  it('returns an empty list when the network context or cookie header is missing', () => {
    expect(makeHandler(undefined).getAll()).toEqual([])
    expect(makeHandler({}).getAll()).toEqual([])
    expect(makeHandler({ cookies: '' }).getAll()).toEqual([])
  })

  it('parses cookie pairs, trims whitespace, and preserves values containing equals signs', () => {
    const handler = makeHandler({
      cookies: ' session = abc123 ; flag; theme=dark; auth=jwt=token; =ignored ',
    })

    expect(handler.getAll()).toEqual([
      { name: 'session', value: 'abc123' },
      { name: 'flag', value: '' },
      { name: 'theme', value: 'dark' },
      { name: 'auth', value: 'jwt=token' },
    ])
  })

  it('decodes cookie values and keeps the raw value when decoding fails', () => {
    const handler = makeHandler({ cookies: 'encoded=hello%20world; malformed=%E0%A4%A' })

    expect(handler.getAll()).toEqual([
      { name: 'encoded', value: 'hello world' },
      { name: 'malformed', value: '%E0%A4%A' },
    ])
  })

  it('queues cookies and serializes encoded values with production defaults and attributes', () => {
    const handler = makeHandler(undefined, 'production')
    const expires = new Date('2030-01-02T03:04:05.000Z')
    const cookies: ISsrCookieToSet[] = [
      {
        name: 'session id',
        value: 'a+b',
        path: '/app',
        maxAge: 3600,
        expires,
        domain: 'example.com',
        secure: true,
        httpOnly: true,
        sameSite: 'strict',
        partitioned: true,
        priority: 'high',
      },
    ]

    handler.setAll(cookies)

    expect(handler.getPendingCookies()).toEqual([
      'session%20id=a%2Bb; Path=/app; Max-Age=3600; Expires=Wed, 02 Jan 2030 03:04:05 GMT; Domain=example.com; Secure; HttpOnly; SameSite=Strict; Partitioned; Priority=High',
    ])
    expect(handler.getPendingCookies()).toEqual(handler.getPendingCookies())
  })

  it('accumulates cookies across setAll calls', () => {
    const handler = makeHandler(undefined)

    handler.setAll([{ name: 'first', value: '1' }])
    handler.setAll([{ name: 'second', value: '2' }])

    expect(handler.getPendingCookies()).toEqual([
      'first=1; Path=/; HttpOnly; SameSite=Lax',
      'second=2; Path=/; HttpOnly; SameSite=Lax',
    ])
  })

  it('serializes an undefined runtime value as an empty value', () => {
    const handler = makeHandler(undefined)
    const cookie = { name: 'empty' } as ISsrCookieToSet

    handler.setAll([cookie])

    expect(handler.getPendingCookies()).toEqual(['empty=; Path=/; HttpOnly; SameSite=Lax'])
  })
  it('uses default options and lets cookie options override them', () => {
    const handler = makeHandler(undefined, 'development', {
      path: '/default',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })

    handler.setAll([
      { name: 'defaults', value: 'ok' },
      {
        name: 'overrides',
        value: 'ok',
        path: undefined,
        httpOnly: false,
        secure: false,
        sameSite: undefined,
      },
    ])

    expect(handler.getPendingCookies()).toEqual([
      'defaults=ok; Path=/default; Secure; HttpOnly; SameSite=Lax',
      'overrides=ok',
    ])
  })

  it('handles boolean SameSite values and defined false partitioned values', () => {
    const handler = makeHandler(undefined)

    handler.setAll([
      { name: 'strict', value: '1', sameSite: true, partitioned: false },
      { name: 'unset', value: '1', sameSite: false, partitioned: undefined },
    ])

    expect(handler.getPendingCookies()).toEqual([
      'strict=1; Path=/; HttpOnly; SameSite=Strict; Partitioned',
      'unset=1; Path=/; HttpOnly',
    ])
  })
})

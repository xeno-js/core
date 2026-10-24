import type { XenoIncomingRequest } from '@xeno-js/shared'
import { describe, expect, it } from 'vitest'

import { HttpAdapter } from '../adapter.http'
import { UrlBuilder } from '../url-builder.http'

function makeIncomingRequest(
  method: string,
  url: string,
  body?: unknown,
  path = '/',
  signal?: AbortSignal,
  headers = new Headers({ 'x-test': 'value' }),
): XenoIncomingRequest {
  return { method, url, headers, body, signal, path }
}

describe('HttpAdapter', () => {
  const adapter = new HttpAdapter(new UrlBuilder())

  it('adapts relative URLs against localhost and exposes the URL path', () => {
    const request = adapter.adapt(makeIncomingRequest('get', '/users?active=true#top'))

    expect(request).toBeInstanceOf(Request)
    expect(request.url).toBe('http://localhost/users?active=true#top')
    expect(request.path).toBe('/users')
    expect(request.method).toBe('GET')
    expect(request.headers.get('x-test')).toBe('value')
    expect(request.body).toBeNull()
  })

  it('preserves absolute URLs and abort signals', () => {
    const controller = new AbortController()
    const request = adapter.adapt(
      makeIncomingRequest(
        'head',
        'https://api.example.com/items/1',
        undefined,
        '/items/1',
        controller.signal,
      ),
    )

    expect(request.url).toBe('https://api.example.com/items/1')
    expect(request.path).toBe('/items/1')
    expect(request.signal.aborted).toBe(controller.signal.aborted)
  })

  it.each(['GET', 'HEAD', 'OPTIONS'])('omits the body for %s requests', (method) => {
    const request = adapter.adapt(makeIncomingRequest(method, '/resource', { key: 'value' }))

    expect(request.body).toBeNull()
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'serializes object bodies for %s requests',
    async (method) => {
      const request = adapter.adapt(makeIncomingRequest(method, '/resource', { key: 'value' }))
      await expect(request.text()).resolves.toBe('{"key":"value"}')
    },
  )

  it('keeps string and supported body instances unchanged', async () => {
    const form = new FormData()
    form.set('name', 'Ada')
    const params = new URLSearchParams({ name: 'Ada' })
    const bytes = new Uint8Array([1, 2, 3])
    const blob = new Blob(['payload'])
    const buffer = new ArrayBuffer(2)

    const cases: [unknown, (body: Request['body']) => void][] = [
      ['plain text', (body) => expect(body).not.toBeNull()],
      [form, (body) => expect(body).not.toBeNull()],
      [params, (body) => expect(body).not.toBeNull()],
      [bytes, (body) => expect(body).not.toBeNull()],
      [blob, (body) => expect(body).not.toBeNull()],
      [buffer, (body) => expect(body).not.toBeNull()],
    ]

    for (const [body, assertBody] of cases) {
      const request = adapter.adapt(makeIncomingRequest('POST', '/resource', body))
      assertBody(request.body)
    }

    expect(await adapter.adapt(makeIncomingRequest('POST', '/resource', 'plain text')).text()).toBe(
      'plain text',
    )
    expect(await adapter.adapt(makeIncomingRequest('POST', '/resource', params)).text()).toBe(
      'name=Ada',
    )
    expect(
      await adapter.adapt(makeIncomingRequest('POST', '/resource', bytes)).arrayBuffer(),
    ).toEqual(bytes.buffer)
    expect(await adapter.adapt(makeIncomingRequest('POST', '/resource', blob)).text()).toBe(
      'payload',
    )
  })

  it.each([0, true, false, 12n])('stringifies primitive request bodies (%s)', async (body) => {
    const request = adapter.adapt(makeIncomingRequest('POST', '/resource', body))

    await expect(request.text()).resolves.toBe(String(body))
  })

  it('omits bodies for undefined body values and rejects invalid methods', () => {
    const missingBody = adapter.adapt(makeIncomingRequest('POST', '/resource'))

    expect(missingBody.body).toBeNull()
    expect(() => adapter.adapt(makeIncomingRequest('', '/resource', 'payload'))).toThrow()
  })

  it('throws for invalid URLs', () => {
    expect(() => adapter.adapt(makeIncomingRequest('GET', 'http://[invalid'))).toThrow()
  })
})

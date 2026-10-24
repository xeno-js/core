import { describe, expect, it, vi } from 'vitest'

import { HttpHeaderExtractor } from '../http-header.extractor'

const VALID_GUID = '550e8400-e29b-41d4-a716-446655440000'
const TOKEN = 'mytoken'

function makeCookieExtractor(cookieValue: string | undefined) {
  return { extract: vi.fn().mockReturnValue(cookieValue) }
}

describe('HttpHeaderExtractor', () => {
  describe('extract', () => {
    it('returns a fully populated Metadata when all headers are present', () => {
      const cookieExtractor = makeCookieExtractor('csrf-cookie-val')
      const extractor = new HttpHeaderExtractor(cookieExtractor, undefined, 'XSRF-TOKEN')

      const headers = new Headers({
        'x-correlation-id': VALID_GUID,
        'x-request-id': VALID_GUID,
        'x-forwarded-for': '192.168.1.1',
        'x-span-id': VALID_GUID,
        'cookie': 'XSRF-TOKEN=csrf-cookie-val',
        'origin': 'http://localhost:3000',
      })

      const result = extractor.extract(headers)

      expect(result.correlationId).toBe(VALID_GUID)
      expect(result.requestId).toBe(VALID_GUID)
      expect(result.clientIp).toBe('192.168.1.1')
      expect(result.spanId).toBe(VALID_GUID)
      expect(result.csrfCookie).toBe('csrf-cookie-val')
      expect(result.origin).toBe('http://localhost:3000')
    })

    it('returns undefined fields when headers are absent', () => {
      const cookieExtractor = makeCookieExtractor(undefined)
      const extractor = new HttpHeaderExtractor(cookieExtractor, undefined, 'XSRF-TOKEN')

      const result = extractor.extract(new Headers())

      expect(result.correlationId).toBeUndefined()
      expect(result.requestId).toBeUndefined()
      expect(result.clientIp).toBeUndefined()
      expect(result.spanId).toBeUndefined()
      expect(result.csrfCookie).toBeUndefined()
    })

    it('returns undefined for correlationId when value is not a valid GUID', () => {
      const cookieExtractor = makeCookieExtractor(undefined)
      const extractor = new HttpHeaderExtractor(cookieExtractor, undefined, 'XSRF-TOKEN')

      const result = extractor.extract(new Headers({ 'x-correlation-id': 'not-a-guid' }))

      expect(result.correlationId).toBeUndefined()
    })

    it('returns undefined for requestId when value is not a valid GUID', () => {
      const cookieExtractor = makeCookieExtractor(undefined)
      const extractor = new HttpHeaderExtractor(cookieExtractor, undefined, 'XSRF-TOKEN')

      const result = extractor.extract(new Headers({ 'x-request-id': 'not-a-guid' }))

      expect(result.requestId).toBeUndefined()
    })

    it('delegates token extraction to the injected bearerExtractor', () => {
      const cookieExtractor = makeCookieExtractor(undefined)
      const extractor = new HttpHeaderExtractor(cookieExtractor, undefined, 'XSRF-TOKEN')
      const headers = new Headers({ authorization: `Bearer ${TOKEN}` })

      extractor.extract(headers)
    })

    it('respects custom trustedIp header configuration', () => {
      const cookieExtractor = makeCookieExtractor(undefined)
      const extractor = new HttpHeaderExtractor(cookieExtractor, 'x-custom-ip', 'XSRF-TOKEN')

      const result = extractor.extract(
        new Headers({
          'x-custom-ip': '172.16.0.1',
          'x-forwarded-for': '192.168.1.1',
        }),
      )

      expect(result.clientIp).toBe('172.16.0.1')
    })
  })
})

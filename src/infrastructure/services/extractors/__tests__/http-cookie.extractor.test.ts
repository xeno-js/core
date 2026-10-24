import { describe, expect, it } from 'vitest'

import { HttpCookieExtractor } from '../http-cookie.extractor'

describe('HttpCookieExtractor', () => {
  it('returns the cookie value when the requested name is present', () => {
    const extractor = new HttpCookieExtractor()

    expect(extractor.extract({ header: 'session=abc123; theme=dark', name: 'session' })).toBe(
      'abc123',
    )
  })

  it('returns undefined when the header is missing', () => {
    const extractor = new HttpCookieExtractor()

    expect(extractor.extract({ header: undefined, name: 'session' })).toBeUndefined()
  })

  it('skips malformed cookie pairs without a name', () => {
    const extractor = new HttpCookieExtractor()

    expect(extractor.extract({ header: 'bad; session=abc123', name: 'session' })).toBe('abc123')
  })

  it('returns undefined when the requested cookie does not exist', () => {
    const extractor = new HttpCookieExtractor()

    expect(extractor.extract({ header: 'session=abc123', name: 'theme' })).toBeUndefined()
  })

  it('decodes URL-encoded cookie values', () => {
    const extractor = new HttpCookieExtractor()

    expect(extractor.extract({ header: 'token=hello%20world', name: 'token' })).toBe('hello world')
  })

  it('returns undefined when the cookie value is not valid percent-encoding', () => {
    const extractor = new HttpCookieExtractor()

    expect(extractor.extract({ header: 'token=%E0%A4%A', name: 'token' })).toBe('%E0%A4%A')
  })
})

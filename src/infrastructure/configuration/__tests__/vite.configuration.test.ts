import { describe, expect, it } from 'vitest'

import { ViteConfigurationService } from '../vite.configuration'

describe('ViteConfigurationService', () => {
  it('should resolve keys with and without the VITE prefix', () => {
    const service = new ViteConfigurationService({
      VITE_API_URL: 'https://api.example.com',
      VITE_EXPLICIT: 'explicit-value',
    })

    expect(service.get('API_URL')).toBe('https://api.example.com')
    expect(service.get('VITE_EXPLICIT')).toBe('explicit-value')
  })

  it('should return defaults for empty values', () => {
    const service = new ViteConfigurationService({ VITE_EMPTY: '' })

    expect(service.get('EMPTY', 'fallback')).toBe('fallback')
    expect(service.getNumber('EMPTY', 42)).toBe(42)
    expect(service.getBoolean('EMPTY', true)).toBe(true)
  })

  it('should parse numeric values and use the default for invalid numbers', () => {
    const service = new ViteConfigurationService({
      VITE_PORT: '8080',
      VITE_INVALID: 'not-a-number',
    })

    expect(service.getNumber('PORT')).toBe(8080)
    expect(service.getNumber('INVALID', 3000)).toBe(3000)
  })

  it('should parse supported boolean values and use the default otherwise', () => {
    const service = new ViteConfigurationService({
      VITE_TRUE: ' TrUe ',
      VITE_ONE: '1',
      VITE_FALSE: ' false ',
      VITE_ZERO: '0',
      VITE_INVALID: 'yes',
    })

    expect(service.getBoolean('TRUE')).toBe(true)
    expect(service.getBoolean('ONE')).toBe(true)
    expect(service.getBoolean('FALSE')).toBe(false)
    expect(service.getBoolean('ZERO')).toBe(false)
    expect(service.getBoolean('INVALID', true)).toBe(true)
  })

  it('should return required values and throw when they are missing', () => {
    const service = new ViteConfigurationService({
      VITE_REQUIRED: 'present',
      VITE_EMPTY: '',
    })

    expect(service.getOrThrow('REQUIRED')).toBe('present')
    expect(() => service.getOrThrow('EMPTY')).toThrow(
      '[Configuration Error]: Missing required environment variable "EMPTY".',
    )
  })
})

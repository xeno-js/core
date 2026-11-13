import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EdgeCryptoService } from '../crypto.service'

describe('EdgeCryptoService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('generates a byte array of the requested size using WebCrypto', () => {
    const service = new EdgeCryptoService()
    const getRandomValuesMock = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      const typedArray = array as Uint8Array
      typedArray.fill(7)
      return array
    })

    const result = service.randomBytes(4)

    expect(result).toBeInstanceOf(Uint8Array)
    expect(result).toEqual(new Uint8Array([7, 7, 7, 7]))
    expect(getRandomValuesMock).toHaveBeenCalledWith(expect.any(Uint8Array))
  })

  it('derives a base64url HMAC-SHA256 signature from the secret and payload', async () => {
    const service = new EdgeCryptoService()
    const importKeyMock = vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey)
    const signMock = vi
      .spyOn(crypto.subtle, 'sign')
      .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)

    const result = await service.hmacSha256('secret', 'payload')

    expect(importKeyMock).toHaveBeenCalledWith(
      'raw',
      new TextEncoder().encode('secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    expect(signMock).toHaveBeenCalledWith('HMAC', {}, new TextEncoder().encode('payload'))
    expect(result).toBe(
      btoa(String.fromCharCode(1, 2, 3))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, ''),
    )
  })

  it('returns false when the byte arrays have different lengths', () => {
    const service = new EdgeCryptoService()

    expect(service.timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1]))).toBe(false)
  })

  it('returns true when all bytes match exactly', () => {
    const service = new EdgeCryptoService()

    expect(service.timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
  })

  it('returns false when byte arrays differ in any position', () => {
    const service = new EdgeCryptoService()

    expect(service.timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(
      false,
    )
  })
})

import type { ICryptoService } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CsrfTokenService } from '../csrf-token.service'

function makeCryptoService(overrides: Partial<ICryptoService> = {}) {
  const randomBytesMock = vi.fn().mockReturnValue(new Uint8Array(32).fill(1))
  const hmacSha256Mock = vi.fn().mockImplementation(async (_secret: string, data: string) => {
    const encoder = new TextEncoder()
    return Array.from(encoder.encode(data))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  })
  const timingSafeEqualMock = vi.fn().mockReturnValue(true)

  const cryptoService: ICryptoService = {
    randomBytes: randomBytesMock,
    hmacSha256: hmacSha256Mock,
    timingSafeEqual: timingSafeEqualMock,
    ...overrides,
  }

  return { cryptoService, randomBytesMock, hmacSha256Mock, timingSafeEqualMock }
}

describe('CsrfTokenService', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('generates a token using a nonce and HMAC signature', async () => {
    const { cryptoService, randomBytesMock, hmacSha256Mock } = makeCryptoService()
    const service = new CsrfTokenService('secret', cryptoService)

    const token = await service.generate('user-123')

    expect(token).toContain('.')
    expect(randomBytesMock).toHaveBeenCalledWith(32)
    expect(hmacSha256Mock).toHaveBeenCalledWith('secret', expect.stringContaining('user-123.'))
    expect(token.split('.').length).toBe(2)
  })

  it('accepts a token when the signature matches the subject and nonce', async () => {
    const hmacSha256Mock = vi.fn().mockResolvedValue('matching-signature')
    const timingSafeEqualMock = vi.fn().mockReturnValue(true)
    const { cryptoService } = makeCryptoService({
      hmacSha256: hmacSha256Mock,
      timingSafeEqual: timingSafeEqualMock,
    })
    const service = new CsrfTokenService('secret', cryptoService)

    const isValid = await service.validate('nonce.matching-signature', 'user-123')

    expect(isValid).toBe(true)
    expect(hmacSha256Mock).toHaveBeenCalledWith('secret', 'user-123.nonce')
    expect(timingSafeEqualMock).toHaveBeenCalledWith(
      new TextEncoder().encode('matching-signature'),
      new TextEncoder().encode('matching-signature'),
    )
  })

  it('rejects tokens without a dot separator or empty nonce/signature', async () => {
    const hmacSha256Mock = vi.fn()
    const { cryptoService } = makeCryptoService({ hmacSha256: hmacSha256Mock })
    const service = new CsrfTokenService('secret', cryptoService)

    await expect(service.validate('invalid', 'user-123')).resolves.toBe(false)
    await expect(service.validate('.signature', 'user-123')).resolves.toBe(false)
    await expect(service.validate('nonce.', 'user-123')).resolves.toBe(false)
    expect(hmacSha256Mock).not.toHaveBeenCalled()
  })

  it('rejects a token when the signature length differs from the expected hash', async () => {
    const hmacSha256Mock = vi.fn().mockResolvedValue('expected')
    const timingSafeEqualMock = vi.fn().mockReturnValue(true)
    const { cryptoService } = makeCryptoService({
      hmacSha256: hmacSha256Mock,
      timingSafeEqual: timingSafeEqualMock,
    })
    const service = new CsrfTokenService('secret', cryptoService)

    const isValid = await service.validate('nonce.abc', 'user-123')

    expect(isValid).toBe(false)
    expect(timingSafeEqualMock).not.toHaveBeenCalled()
  })

  it('rejects a token when timingSafeEqual reports inequality', async () => {
    const hmacSha256Mock = vi.fn().mockResolvedValue('expected')
    const timingSafeEqualMock = vi.fn().mockReturnValue(false)
    const { cryptoService } = makeCryptoService({
      hmacSha256: hmacSha256Mock,
      timingSafeEqual: timingSafeEqualMock,
    })
    const service = new CsrfTokenService('secret', cryptoService)

    const isValid = await service.validate('nonce.expected', 'user-123')

    expect(isValid).toBe(false)
    expect(timingSafeEqualMock).toHaveBeenCalledOnce()
  })
})

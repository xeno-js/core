import type { ICryptoService, ICsrfTokenService } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description Service for generating and validating CSRF tokens
 */
export class CsrfTokenService implements ICsrfTokenService {
  constructor(
    private readonly _secret: string,
    private readonly _cryptoService: ICryptoService,
  ) {}

  public async generate(subject: string): Promise<string> {
    const randomBuffer = this._cryptoService.randomBytes(32)
    const nonce = btoa(String.fromCharCode(...randomBuffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    const signature = await this._cryptoService.hmacSha256(this._secret, `${subject}.${nonce}`)

    return `${nonce}.${signature}`
  }

  public async validate(token: string, subject: string): Promise<boolean> {
    const separatorIndex = token.indexOf('.')

    if (separatorIndex <= 0) return false

    const nonce = token.slice(0, separatorIndex)
    const signature = token.slice(separatorIndex + 1)

    if (Guards.isNullOrEmpty(nonce) || Guards.isNullOrEmpty(signature)) return false

    const expected = await this._cryptoService.hmacSha256(this._secret, `${subject}.${nonce}`)

    const encoder = new TextEncoder()
    const actualBuffer = encoder.encode(signature)
    const expectedBuffer = encoder.encode(expected)

    if (actualBuffer.length !== expectedBuffer.length) return false

    return this._cryptoService.timingSafeEqual(actualBuffer, expectedBuffer)
  }
}

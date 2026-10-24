import type { ICryptoService } from '@xeno-js/shared'

/**
 * @description The EdgeCryptoService class implements the ICryptoService interface, providing a concrete implementation for cryptographic operations using the Web Cryptography API.
 *
 */
export class EdgeCryptoService implements ICryptoService {
  public randomBytes(size: number): Uint8Array {
    const buffer = new Uint8Array(size)
    crypto.getRandomValues(buffer)
    return buffer
  }

  public async hmacSha256(secret: string, data: string): Promise<string> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secret)
    const messageData = encoder.encode(data)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)

    // Converte l'ArrayBuffer risultante in una stringa base64url compatibile
    return btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  public timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false
    }
    let mismatch = 0
    for (let i = 0; i < a.length; i++) {
      mismatch |= a[i] ^ b[i]
    }
    return mismatch === 0
  }
}

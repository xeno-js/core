import type { Optional, XenoRequest } from '@xeno-js/shared'
import type { IIPResolver } from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'

/**
 * @description ClientIpResolver is a resolver that extracts the client IP address from the network context or the socket IP address.
 */
export class ClientIpResolver implements IIPResolver {
  constructor(private readonly _trustedProxies: string[] = []) {}

  public resolve(req: XenoRequest, clientIp: Optional<string>): Optional<string> {
    const socketIp = req.socket?.remoteAddress

    if (!Guards.isDefined(socketIp))
      return !Guards.isNullOrEmpty(clientIp) ? clientIp.split(',')[0].trim() : undefined

    const isTrustedProxy = this._trustedProxies.includes(socketIp)

    if (!isTrustedProxy) return socketIp
    if (Guards.isDefined(clientIp)) return clientIp.split(',')[0].trim()

    return socketIp
  }
}

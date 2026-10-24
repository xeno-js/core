import { Guards, type IFactory } from '@xeno-js/shared'

export class UrlBuilder implements IFactory<Headers, string> {
  create(headers: Headers): string {
    const forwardedProto = headers.get('x-forwarded-proto')
    const protocol = Guards.isDefined(forwardedProto) ? forwardedProto.split(',')[0].trim() : 'http'

    const forwardedHost = headers.get('x-forwarded-host')
    const hostHeader = headers.get('host')
    const host = Guards.isDefined(forwardedHost)
      ? forwardedHost.split(',')[0].trim()
      : (hostHeader ?? 'localhost')

    return `${protocol}://${host}`
  }
}

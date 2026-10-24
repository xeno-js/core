import type {
  IBaseMapper,
  Identity,
  MessagingContext,
  NetworkContext,
  RequestContext,
  TracingContext,
} from '@xeno-js/shared'
import { Guards, type Metadata, type Optional } from '@xeno-js/shared'

interface ContextMapperSource {
  readonly metadata: Metadata
  readonly identity: Identity
  readonly path: string
}

export const ContextMapper: IBaseMapper<ContextMapperSource, RequestContext> = Object.freeze({
  /**
   * @description Maps to RequestContext. It extracts relevant information from the object, such as correlation ID, request ID, authentication token, client IP, user agent, format indicator, and messaging context (if available). The method constructs a RequestContext object that encapsulates all this information, providing a structured representation of the request context for further processing in the application.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  map: (source: ContextMapperSource): RequestContext => {
    const { metadata, identity, path } = source

    const network: NetworkContext = {
      requestId: metadata.requestId!,
      clientIp: metadata.clientIp,
      userAgent: metadata.userAgent,
      formatIndicator: metadata.formatIndicator,
      path,
      csrf: metadata.csrf,
      csrfCookie: metadata.csrfCookie,
      cookies: metadata.cookies,
      origin: metadata.origin,
    }
    const tracing: TracingContext = {
      correlationId: metadata.correlationId!,
      startTime: Date.now(),
      spanId: metadata.spanId,
      parentSpanId: metadata.parentSpanId,
      referer: metadata.referer,
    }
    const messaging = _buildMessagingContext(metadata)

    const requestContext: RequestContext = {
      identity,
      network,
      tracing,
      messaging,
    }

    return requestContext
  },
} as const)

/**
 * @description Builds the MessagingContext based on the provided Metadata. It checks for the presence of sequence data, expiration, and return address in the metadata to determine if a MessagingContext should be created. If any of these properties are defined, it constructs a MessagingContext object with the relevant information; otherwise, it returns undefined. This method encapsulates the logic for determining whether messaging-related context is available and ensures that the resulting MessagingContext is properly structured.
 * @param meta The Metadata object extracted from the HTTP request headers, containing information such as correlation ID, request ID, authentication token, client IP, user agent, format indicator, return address, expiration, and sequence data. This metadata is used to determine whether a MessagingContext should be created and what properties it should contain.
 * @returns An Optional<MessagingContext> object that contains messaging-related context information if available; otherwise, it returns undefined. The MessagingContext includes properties such as return address, expiration time, and sequence information (sequence ID, position, and size) if they are present in the metadata.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
function _buildMessagingContext(meta: Metadata): Optional<MessagingContext> {
  const hasSequenceData =
    Guards.isDefined(meta.sequence?.sequenceId) ||
    Guards.isDefined(meta.sequence?.position) ||
    Guards.isDefined(meta.sequence?.size)

  const hasMessagingData =
    hasSequenceData || Guards.isDefined(meta.expiration) || Guards.isDefined(meta.returnAddress)

  if (!hasMessagingData) return undefined

  return {
    returnAddress: meta.returnAddress,
    expiration: meta.expiration,
    sequence:
      hasSequenceData && Guards.isDefined(meta.sequence)
        ? {
            sequenceId: meta.sequence.sequenceId,
            position: meta.sequence.position,
            size: meta.sequence.size,
          }
        : undefined,
  }
}

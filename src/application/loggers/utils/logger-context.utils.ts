import type { LoggerContext, RequestContext } from '@xeno-js/shared'
import { HttpHelper, type Optional } from '@xeno-js/shared'

/**
 * @description LoggerUtils provides utility functions for working with LoggerContext objects.
 */
export const LoggerUtils = Object.freeze({
  /**
   * @description toSafeContext converts a RequestContext object to a LoggerContext object, ensuring that only the necessary fields are included.
   * @param ctx The RequestContext object to convert.
   * @returns The converted LoggerContext object.
   */
  toSafeContext(ctx: Optional<RequestContext>): LoggerContext {
    return {
      identity: {
        userId: ctx?.identity?.userId,
        tenantId: ctx?.identity?.tenantId,
      },
      network: {
        requestId: ctx?.network?.requestId,
        path: ctx?.network?.path,
        origin: ctx?.network?.origin,
        clientIp: HttpHelper.maskIp(ctx?.network?.clientIp),
      },
      tracing: {
        correlationId: ctx?.tracing?.correlationId,
        spanId: ctx?.tracing?.spanId,
        startTime: ctx?.tracing?.startTime,
        parentSpanId: ctx?.tracing.parentSpanId,
      },
      messaging: ctx?.messaging,
    }
  },
} as const)

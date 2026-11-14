import type { Dictionary, Optional, RequestContext } from '@xeno-js/shared'
import { Guards, HttpHelper, StringHelper } from '@xeno-js/shared'

/**
 * @description LoggerUtils provides utility functions for working with LoggerContext objects.
 */
export const LoggerUtils = Object.freeze({
  /**
   * @description toSafeContext converts a RequestContext object to a LoggerContext object, ensuring that only the necessary fields are included.
   * @param ctx The RequestContext object to convert.
   * @returns The converted LoggerContext object.
   */
  toSafeContext(ctx: Optional<RequestContext>): Dictionary {
    const context = {
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
    return StringHelper.safeStringifyObject(context)
  },

  toNormalizeError(error: unknown): unknown {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
        cause: error.cause,
      }
    }
    const errorString = Guards.isString(error) ? error : StringHelper.safeStringify(error)
    const customError = new Error(errorString)

    if (Guards.isObject(error) && Guards.isDefined(error)) {
      Object.assign(customError, error)
    }

    return customError
  },
} as const)

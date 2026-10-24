import type {
  Guid,
  IContextAccessor,
  ILoggerClient,
  LogLevel,
  RequestContext,
} from '@xeno-js/shared'
import { LOG_LEVEL, LOG_LEVEL_NAMES } from '@xeno-js/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseLogger } from '../base.logger'
import { LoggerUtils } from '../utils'

const makeRequestContext = (
  executionContext?: RequestContext,
): IContextAccessor<RequestContext> => ({
  getContext: vi.fn().mockReturnValue(executionContext),
})

const makeExecutionContext = (): RequestContext => ({
  identity: {
    userId: '123' as unknown as Guid,
    email: 'admin@example.com',
    name: 'admin',
    tenantId: '456' as unknown as Guid,
    roles: ['admin'],
    permissions: ['read'],
  },
  network: {
    requestId: '789' as unknown as Guid,
    clientIp: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    formatIndicator: 'json',
    path: '/api/test',
    csrf: undefined,
    csrfCookie: '',
    origin: 'http://localhost:3000',
  },
  tracing: {
    correlationId: 'req-1' as unknown as Guid,
    startTime: Date.now(),
    spanId: 'span-1',
    parentSpanId: 'parent-span-1',
  },
  messaging: undefined,
})

describe('BaseLogger', () => {
  let trackMock: ReturnType<typeof vi.fn>
  let requestContext: IContextAccessor<RequestContext>
  let executionContext: RequestContext
  let expectedSafeContext: ReturnType<typeof LoggerUtils.toSafeContext>

  beforeEach(() => {
    trackMock = vi.fn()
    executionContext = makeExecutionContext()
    requestContext = makeRequestContext(executionContext)
    expectedSafeContext = LoggerUtils.toSafeContext(executionContext)
  })

  describe('info()', (): void => {
    it('forwards an INFO message to the client when minLevel is INFO', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.INFO, [client])
      logger.info('hello')

      expect(trackMock).toHaveBeenCalledOnce()
      expect(trackMock).toHaveBeenCalledWith(
        LOG_LEVEL.INFO,
        `[${LOG_LEVEL_NAMES[LOG_LEVEL.INFO]}] hello`,
        expectedSafeContext,
        undefined,
      )
    })

    it('does NOT forward when INFO is below minLevel WARN', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.WARN, [client])
      logger.info('silent')
      expect(trackMock).not.toHaveBeenCalled()
    })
  })

  describe('warn()', (): void => {
    it('forwards a WARN message to the client when minLevel is INFO', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.INFO, [client])
      logger.warn('careful')

      expect(trackMock).toHaveBeenCalledOnce()
      expect(trackMock).toHaveBeenCalledWith(
        LOG_LEVEL.WARN,
        `[${LOG_LEVEL_NAMES[LOG_LEVEL.WARN]}] careful`,
        expectedSafeContext,
        undefined,
      )
    })

    it('does NOT forward when WARN is below minLevel ERROR', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.ERROR, [client])
      logger.warn('silent')
      expect(trackMock).not.toHaveBeenCalled()
    })
  })

  describe('debug()', (): void => {
    it('forwards a DEBUG message when minLevel is DEBUG', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.DEBUG, [client])
      logger.debug('verbose')

      expect(trackMock).toHaveBeenCalledOnce()
      expect(trackMock).toHaveBeenCalledWith(
        LOG_LEVEL.DEBUG,
        `[${LOG_LEVEL_NAMES[LOG_LEVEL.DEBUG]}] verbose`,
        expectedSafeContext,
        undefined,
      )
    })

    it('does NOT forward DEBUG when minLevel is INFO', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.INFO, [client])
      logger.debug('silent')
      expect(trackMock).not.toHaveBeenCalled()
    })
  })

  describe('error()', (): void => {
    it('forwards an ERROR message with error object', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.INFO, [client])
      const err = new Error('boom')
      logger.error('something went wrong', err)

      expect(trackMock).toHaveBeenCalledOnce()
      expect(trackMock).toHaveBeenCalledWith(
        LOG_LEVEL.ERROR,
        `[${LOG_LEVEL_NAMES[LOG_LEVEL.ERROR]}] something went wrong`,
        expectedSafeContext,
        err,
      )
    })

    it('does NOT forward ERROR when minLevel is above ERROR', (): void => {
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, (LOG_LEVEL.ERROR + 1) as LogLevel, [client])
      logger.error('silent', new Error('x'))
      expect(trackMock).not.toHaveBeenCalled()
    })
  })

  describe('broadcast — context handling', (): void => {
    it('passes safe undefined context when getContext() returns undefined', (): void => {
      const ctxWithoutData = makeRequestContext(undefined)
      const client: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const logger = new BaseLogger(ctxWithoutData, LOG_LEVEL.INFO, [client])
      logger.info('no context')

      expect(trackMock).toHaveBeenCalledWith(
        LOG_LEVEL.INFO,
        `[${LOG_LEVEL_NAMES[LOG_LEVEL.INFO]}] no context`,
        LoggerUtils.toSafeContext(undefined),
        undefined,
      )
    })
  })

  describe('broadcast — multiple clients', (): void => {
    it('forwards the message to every registered client', (): void => {
      const trackMock2 = vi.fn()
      const client1: ILoggerClient = { track: trackMock as ILoggerClient['track'] }
      const client2: ILoggerClient = { track: trackMock2 as ILoggerClient['track'] }
      const logger = new BaseLogger(requestContext, LOG_LEVEL.INFO, [client1, client2])
      logger.info('broadcast')

      expect(trackMock).toHaveBeenCalledOnce()
      expect(trackMock2).toHaveBeenCalledOnce()
    })

    it('does nothing when the clients array is empty', (): void => {
      const logger = new BaseLogger(requestContext, LOG_LEVEL.INFO, [])
      expect(() => logger.info('no clients')).not.toThrow()
    })
  })
})

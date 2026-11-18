import type { IRequest, IValidatorService } from '@xeno-js/shared'
import { AppError, Result } from '@xeno-js/shared'
import { ERROR_CODES, STATUS_CODES } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { SchemaValidationStrategy } from '../schema-validation.strategy'

const makeRequest = (intent = 'TestIntent'): IRequest<{ id: string }> => ({
  intent,
  type: 'COMMAND',
})

const makeValidator = () => {
  const validate = vi.fn<IValidatorService['validate']>()
  const addSchema = vi.fn<IValidatorService['addSchema']>()
  const validator: IValidatorService = { validate, addSchema }
  return { validator, validate, addSchema }
}

describe('SchemaValidationStrategy', () => {
  describe('execute', () => {
    it('should return ok(true) when validation passes', async () => {
      const { validator, validate } = makeValidator()
      validate.mockResolvedValue(Result.ok(true))

      const strategy = new SchemaValidationStrategy(validator)
      const result = await strategy.execute(makeRequest())

      expect(result.isOk()).toBe(true)
      expect(result.getValueOrThrow()).toBe(true)
    })

    it('should call validator.validate with request.intent and the request', async () => {
      const { validator, validate } = makeValidator()
      validate.mockResolvedValue(Result.ok(true))

      const strategy = new SchemaValidationStrategy(validator)
      const request = makeRequest('MyIntent')
      await strategy.execute(request)

      expect(validate).toHaveBeenCalledOnce()
      expect(validate).toHaveBeenCalledWith('MyIntent', request)
    })

    it('should return fail with VALIDATION_FAILED when validation fails', async () => {
      const { validator, validate } = makeValidator()
      const validationError = AppError.create({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'errors.pipelines.validation_error',
        status: STATUS_CODES.BAD_REQUEST,
        name: 'TestIntent',
        cause: new Error('field is required'),
      })
      validate.mockResolvedValue(Result.fail(validationError))

      const strategy = new SchemaValidationStrategy(validator)
      const result = await strategy.execute(makeRequest())

      expect(result.isOk()).toBe(false)
      const appError = result.getErrorOrThrow()
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_FAILED)
      expect(appError.status).toBe(STATUS_CODES.BAD_REQUEST)
      expect(appError.name).toBe('TestIntent')
    })

    it('should include the validator error message in the cause', async () => {
      const { validator, validate } = makeValidator()
      const originalError = AppError.create({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'some error',
        status: STATUS_CODES.BAD_REQUEST,
        name: 'TestIntent',
        cause: new Error('some error'),
      })
      validate.mockResolvedValue(Result.fail(originalError))

      const strategy = new SchemaValidationStrategy(validator)
      const result = await strategy.execute(makeRequest())

      expect(result.isOk()).toBe(false)
      const appError = result.getErrorOrThrow()
      expect(appError.cause).toBeInstanceOf(Error)
      expect((appError.cause as Error).message).toContain('some error')
    })

    it('should propagate the detailed validator cause instead of the generic message', async () => {
      const { validator, validate } = makeValidator()
      const validatorError = AppError.create({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'errors.validation_failed',
        status: STATUS_CODES.BAD_REQUEST,
        name: 'ZodValidatorService',
        cause: new Error('[name] Required, [email] Invalid email'),
      })
      validate.mockResolvedValue(Result.fail(validatorError))

      const strategy = new SchemaValidationStrategy(validator)
      const result = await strategy.execute(makeRequest())

      const cause = result.getErrorOrThrow().cause as Error
      expect(cause.message).toBe('Validation failed: [name] Required, [email] Invalid email')
    })

    it('should attach the original validator error without interpreting its fields', async () => {
      const { validator, validate } = makeValidator()
      const validatorError = Object.assign(
        AppError.validationError(
          'ZodValidatorService',
          'Validation failed for schema: [name] Required',
        ),
        { issues: [{ code: 'invalid_type', path: 'name', message: 'Required' }] },
      )
      validate.mockResolvedValue(Result.fail(validatorError))

      const strategy = new SchemaValidationStrategy(validator)
      const result = await strategy.execute(makeRequest())

      expect(result.getErrorOrThrow().validatorError).toBe(validatorError)
    })
  })
})

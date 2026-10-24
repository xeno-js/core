import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const guardsMocks = vi.hoisted(() => ({
  isNullOrEmpty: vi.fn((value: unknown) => value === null || value === undefined || value === ''),
  isDefined: vi.fn((value: unknown) => value !== null && value !== undefined && value !== ''),
}))

vi.mock('@xeno-js/shared', () => ({
  Guards: {
    isNullOrEmpty: guardsMocks.isNullOrEmpty,
    isDefined: guardsMocks.isDefined,
  },
}))

import { EnvironmentConfigurationService } from '../node.configuration'

describe('EnvironmentConfigurationService', () => {
  const trackedKeys = [
    'XENO_TEST_CONFIG_VALUE',
    'XENO_TEST_CONFIG_NUMBER',
    'XENO_TEST_CONFIG_BOOLEAN',
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    for (const key of trackedKeys) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of trackedKeys) {
      delete process.env[key]
    }
  })

  it('returns the environment value or the default when missing or empty', () => {
    process.env.XENO_TEST_CONFIG_VALUE = 'active'

    const service = new EnvironmentConfigurationService()

    expect(service.get('XENO_TEST_CONFIG_VALUE')).toBe('active')
    expect(service.get('XENO_TEST_CONFIG_MISSING', 'fallback')).toBe('fallback')

    process.env.XENO_TEST_CONFIG_VALUE = ''

    const emptyValueService = new EnvironmentConfigurationService()

    expect(emptyValueService.get('XENO_TEST_CONFIG_VALUE', 'fallback')).toBe('fallback')
  })

  it('returns parsed numbers and falls back when the key is missing', () => {
    process.env.XENO_TEST_CONFIG_NUMBER = '42'

    const service = new EnvironmentConfigurationService()

    expect(service.getNumber('XENO_TEST_CONFIG_NUMBER')).toBe(42)
    expect(service.getNumber('XENO_TEST_CONFIG_MISSING', 7)).toBe(7)
  })

  it('throws when a numeric value cannot be parsed', () => {
    process.env.XENO_TEST_CONFIG_NUMBER = 'not-a-number'

    const service = new EnvironmentConfigurationService()

    expect(() => service.getNumber('XENO_TEST_CONFIG_NUMBER')).toThrow(
      '[Configuration Error]: Key "XENO_TEST_CONFIG_NUMBER" with value "not-a-number" is not a valid number.',
    )
  })

  it.each([
    ['true', true],
    ['1', true],
    [' false ', false],
    ['0', false],
  ])('parses boolean token %s as %s', (token, expected) => {
    process.env.XENO_TEST_CONFIG_BOOLEAN = token

    const service = new EnvironmentConfigurationService()

    expect(service.getBoolean('XENO_TEST_CONFIG_BOOLEAN')).toBe(expected)
  })

  it('returns the boolean default when the key is missing', () => {
    const service = new EnvironmentConfigurationService()

    expect(service.getBoolean('XENO_TEST_CONFIG_MISSING', true)).toBe(true)
  })

  it('throws when a boolean value is invalid', () => {
    process.env.XENO_TEST_CONFIG_BOOLEAN = 'maybe'

    const service = new EnvironmentConfigurationService()

    expect(() => service.getBoolean('XENO_TEST_CONFIG_BOOLEAN')).toThrow(
      '[Configuration Error]: Key "XENO_TEST_CONFIG_BOOLEAN" with value "maybe" is not a valid boolean.',
    )
  })

  it('returns the configured value or throws when required configuration is missing', () => {
    process.env.XENO_TEST_CONFIG_VALUE = 'required'

    const service = new EnvironmentConfigurationService()

    expect(service.getOrThrow('XENO_TEST_CONFIG_VALUE')).toBe('required')
    expect(() => service.getOrThrow('XENO_TEST_CONFIG_MISSING')).toThrow(
      '[Configuration Error]: Required configuration key "XENO_TEST_CONFIG_MISSING" is missing in the environment.',
    )
  })
})

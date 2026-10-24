import type { ResponseDto, XenoRequest } from '@xeno-js/shared'
import type { IRequestContext } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { CookieResponseMiddleware } from '../cookie-response.middleware'

type TestResponse = ResponseDto<{ ok: true }>
interface TestScope {
  resolve: ReturnType<typeof vi.fn>
}

function makeMiddleware(scope?: TestScope) {
  const getScope = vi.fn(() => scope)
  const requestContext = { getScope } as unknown as IRequestContext<unknown>
  const middleware = new CookieResponseMiddleware(requestContext)

  return { middleware, getScope }
}

function makeResponse(headers?: TestResponse['headers']): TestResponse {
  return { status: 200, ok: true, headers } as TestResponse
}

function makeNext(response: TestResponse) {
  return vi.fn(async () => response)
}

describe('CookieResponseMiddleware', () => {
  it('returns the response without resolving cookies when there is no scope', async () => {
    const { middleware, getScope } = makeMiddleware()
    const response = makeResponse()
    const next = makeNext(response)

    const result = await middleware.execute({} as XenoRequest, next)

    expect(result).toBe(response)
    expect(next).toHaveBeenCalledOnce()
    expect(getScope).toHaveBeenCalledOnce()
  })

  it('leaves response headers unchanged when there are no pending cookies', async () => {
    const resolve = vi.fn(() => ({ getPendingCookies: vi.fn(() => []) }))
    const { middleware } = makeMiddleware({ resolve })
    const headers = { 'Content-Type': 'application/json' }
    const response = makeResponse(headers)

    const result = await middleware.execute({} as XenoRequest, makeNext(response))

    expect(resolve).toHaveBeenCalledWith(TOKENS.COOKIE_HANDLER)
    expect(result).toBe(response)
    expect(result.headers).toBe(headers)
  })

  it('adds pending cookies when the response has no headers', async () => {
    const resolve = vi.fn(() => ({ getPendingCookies: vi.fn(() => ['session=abc']) }))
    const { middleware } = makeMiddleware({ resolve })
    const response = makeResponse()

    const result = await middleware.execute({} as XenoRequest, makeNext(response))

    expect(result.headers).toEqual({ 'Set-Cookie': ['session=abc'] })
  })

  it('appends pending cookies to existing Set-Cookie arrays and preserves other headers', async () => {
    const resolve = vi.fn(() => ({ getPendingCookies: vi.fn(() => ['session=new']) }))
    const { middleware } = makeMiddleware({ resolve })
    const response = makeResponse({
      'Content-Type': 'application/json',
      'Set-Cookie': ['session=old', 'theme=dark'],
    })

    const result = await middleware.execute({} as XenoRequest, makeNext(response))

    expect(result.headers).toEqual({
      'Content-Type': 'application/json',
      'Set-Cookie': ['session=old', 'theme=dark', 'session=new'],
    })
  })

  it('converts an existing Set-Cookie value to an array before appending', async () => {
    const resolve = vi.fn(() => ({ getPendingCookies: vi.fn(() => ['session=new']) }))
    const { middleware } = makeMiddleware({ resolve })
    const response = makeResponse({ 'Set-Cookie': 'session=old' })

    const result = await middleware.execute({} as XenoRequest, makeNext(response))

    expect(result.headers?.['Set-Cookie']).toEqual(['session=old', 'session=new'])
  })

  it('returns the response unchanged when resolving the cookie handler fails', async () => {
    const resolve = vi.fn(() => {
      throw new Error('Cookie handler unavailable')
    })
    const { middleware } = makeMiddleware({ resolve })
    const headers = { 'Content-Type': 'text/plain' }
    const response = makeResponse(headers)

    const result = await middleware.execute({} as XenoRequest, makeNext(response))

    expect(result).toBe(response)
    expect(result.headers).toBe(headers)
  })

  it('returns the response unchanged when reading pending cookies fails', async () => {
    const resolve = vi.fn(() => ({
      getPendingCookies: vi.fn(() => {
        throw new Error('Unable to read pending cookies')
      }),
    }))
    const { middleware } = makeMiddleware({ resolve })
    const response = makeResponse()

    const result = await middleware.execute({} as XenoRequest, makeNext(response))

    expect(result).toBe(response)
    expect(result.headers).toBeUndefined()
  })

  it('propagates errors from the next middleware', async () => {
    const { middleware, getScope } = makeMiddleware()
    const error = new Error('Next middleware failed')
    const next = vi.fn(async () => {
      throw error
    })

    await expect(middleware.execute({} as XenoRequest, next)).rejects.toBe(error)
    expect(getScope).not.toHaveBeenCalled()
  })
})

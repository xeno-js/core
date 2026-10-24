import type { Guid, IFactory, IRequest, ResultType, UserContext } from '@xeno-js/shared'
import { Result } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { BaseHandler } from '../base-handler'

interface TestRequest extends IRequest<TestResponse> {
  requestId: string
}
interface TestResponse {
  ok: true
}

class TestHandler extends BaseHandler<TestRequest, TestResponse> {
  async handle(): Promise<ResultType<TestResponse>> {
    return this.executeAsync()
  }

  async executeAsync(): Promise<ResultType<TestResponse>> {
    return Result.ok({ ok: true })
  }

  async getCurrentUserForTest() {
    return this._getCurrentContext()
  }
}

const makeUserContext = (): UserContext => ({
  userId: 'user-1' as unknown as Guid,
  tenantId: 'tenant-1' as unknown as Guid,
})

const makeRequestContext = (userContext?: UserContext): IFactory<void, UserContext> => ({
  create: vi.fn().mockReturnValue(userContext),
})

describe('BaseHandler', () => {
  it('returns the identity when context exists', async () => {
    const context = makeUserContext()
    const currentUser = {
      userId: context.userId,
      tenantId: context.tenantId,
    }
    const requestContext = makeRequestContext(context)
    const handler = new TestHandler(requestContext)

    await expect(handler.getCurrentUserForTest()).resolves.toEqual(currentUser)
  })
})

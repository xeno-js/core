import type { Delegate, Identity, IRequest, IRequestContext, IStrategy } from '@xeno-js/shared'
import { REQUEST_TYPE, Result } from '@xeno-js/shared'
import { describe, expect, it, vi } from 'vitest'

import { IdentityEnrichmentPipeline } from '../identity-enrichment.pipeline'

const request: IRequest<string> = { intent: 'create-user', type: REQUEST_TYPE.COMMAND }
const identity = { id: 'user-1' } as Identity

function makeContext(currentIdentity: Identity | undefined): {
  context: IRequestContext<never>
  getIdentity: ReturnType<typeof vi.fn>
} {
  const getIdentity = vi.fn().mockReturnValue(currentIdentity)
  return {
    context: { getIdentity } as unknown as IRequestContext<never>,
    getIdentity,
  }
}

function makeStrategy(): {
  strategy: IStrategy<Identity>
  execute: ReturnType<typeof vi.fn>
} {
  const execute = vi.fn().mockResolvedValue(undefined)
  return {
    strategy: { execute },
    execute,
  }
}

describe('IdentityEnrichmentPipeline', () => {
  it('enriches the current identity before invoking next', async () => {
    const { context, getIdentity } = makeContext(identity)
    const { strategy, execute } = makeStrategy()
    const pipeline = new IdentityEnrichmentPipeline(context, strategy)
    const next: Delegate<string> = vi.fn().mockResolvedValue(Result.ok('done'))

    const result = await pipeline.handle(request, next)

    expect(getIdentity).toHaveBeenCalledOnce()
    expect(execute).toHaveBeenCalledWith(identity)
    expect(execute.mock.invocationCallOrder[0]).toBeLessThan(
      (next as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0],
    )
    expect(next).toHaveBeenCalledOnce()
    expect(result.isOk()).toBe(true)
  })

  it('uses an empty identity when the request context has none', async () => {
    const { context } = makeContext(undefined)
    const { strategy, execute } = makeStrategy()
    const pipeline = new IdentityEnrichmentPipeline(context, strategy)
    const next: Delegate<string> = vi.fn().mockResolvedValue(Result.ok('done'))

    await pipeline.handle(request, next)

    expect(execute).toHaveBeenCalledWith({})
    expect(next).toHaveBeenCalledOnce()
  })
})

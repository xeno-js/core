import type { IServiceResilience, Optional } from '@xeno-js/shared'
import { AppError } from '@xeno-js/shared'

/**
 * @description No-Op (Pass-Through) of IServiceResilience.
 * Using when resilience pattern is not required
 */
export class NoOpResilienceService implements IServiceResilience {
  public async execute<T>(operation: () => Promise<T>, signal?: Optional<AbortSignal>): Promise<T> {
    AppError.throwIfAborted(signal, 'NoOpResilienceService.execute')
    return await operation()
  }
}

import type { AggregateRoot, IDisposable, ITransactionState, IUnitOfWork } from '@xeno-js/shared'
import type { ITransactionalDb } from '@xeno-js/shared'
import { AppError } from '@xeno-js/shared'
import { Guards, type Optional } from '@xeno-js/shared'

/**
 * @file unit-of-work.ts
 * @description This file contains the implementation of the Unit of Work pattern.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class UnitOfWork<TTransaction = unknown> implements IUnitOfWork<TTransaction>, IDisposable {
  /**
   * Creates an instance of UnitOfWork.
   * @param _dbContext - The database context used for managing transactions.
   * @param _ttx - The transaction state, which can be either a specific transaction type or null.
   *
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js
   */
  constructor(
    private readonly _dbContext: ITransactionalDb<TTransaction>,
    private readonly _ttx: ITransactionState<TTransaction>,
  ) {}

  async runInTransaction<T, TProps, TEvent = unknown, TId extends string = string>(
    callback: (tx: TTransaction) => Promise<T>,
    aggregates?: AggregateRoot<TProps, TEvent, TId> | AggregateRoot<TProps, TEvent, TId>[],
    signal?: Optional<AbortSignal>,
  ): Promise<T> {
    AppError.throwIfAborted(signal, 'UnitOfWork.runInTransaction')

    return this._dbContext.transaction(async (tx) => {
      this._ttx.state = tx
      try {
        const result = await callback(this._ttx.state)
        return result
      } finally {
        this._ttx.state = null
      }
    })
  }

  async dispose(): Promise<void> {
    if (Guards.isDefined(this._ttx.state)) {
      try {
        if (Guards.hasMethod(this._ttx.state, 'rollback')) {
          await (this._ttx.state as { rollback: () => Promise<void> }).rollback()
        }
      } finally {
        this._ttx.state = null
      }
    }
  }
}

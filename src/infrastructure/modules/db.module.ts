import type {
  DbModuleOptions,
  IDisposable,
  IModule,
  IServiceContainer,
  IServiceScope,
  ITransactionalDb,
  IUnitOfWork,
  XenoRegistry,
} from '@xeno-js/shared'
import { Guards } from '@xeno-js/shared'
import { TOKENS } from '@xeno-js/shared'

import { UnitOfWork } from '../transaction'
import { TransactionState } from '../transaction/transaction-state'

interface OptionalUnitOfWork<TTx = unknown> extends IUnitOfWork<TTx>, IDisposable {}

/**
 * @description The DbModule class is responsible for configuring the database module within the application. It implements the IModule interface, allowing it to be integrated into the application's dependency injection system. The configure method registers a singleton factory for creating an IDbClient instance using the provided configuration options. This design promotes modularity and allows for easy management of database connections and operations throughout the application.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class DbModule<
  TRegistry extends XenoRegistry<DbContext, DbTransaction>,
  DbContext extends ITransactionalDb<DbTransaction>,
  DbTransaction = unknown,
> implements IModule<
  TRegistry,
  DbModuleOptions<DbContext, DbTransaction> & {
    uow?: (c: IServiceScope<TRegistry>) => OptionalUnitOfWork<DbContext>
  }
> {
  async configure(
    container: IServiceContainer<TRegistry>,
    opts: DbModuleOptions<DbContext, DbTransaction> & {
      uow?: (c: IServiceScope<TRegistry>) => OptionalUnitOfWork<DbContext>
    },
  ): Promise<void> {
    const db = opts.client

    container.addScoped(TOKENS.TRANSACTION_STATE, () => {
      return new TransactionState<DbTransaction>()
    })

    if (Guards.isDefined(opts.uow)) {
      container.addScoped(TOKENS.UNIT_OF_WORK, (c) => {
        return opts.uow!(c)
      })
    } else {
      container.addScoped(TOKENS.UNIT_OF_WORK, (c) => {
        const ttx = c.resolve(TOKENS.TRANSACTION_STATE)
        return new UnitOfWork(db, ttx) as unknown as TRegistry['unitOfWork']
      })
    }

    container.addScoped(TOKENS.DB_CONTEXT, (c) => {
      const ttx = c.resolve(TOKENS.TRANSACTION_STATE)
      return new Proxy(db, {
        get(_target, prop, receiver) {
          const activeState = ttx.state
          if (Guards.isDefined(activeState)) {
            const value: unknown = Reflect.get(activeState as object, prop, receiver)
            if (Guards.isFunction(value)) {
              return value.bind(activeState)
            }
            return value
          }
          return Reflect.get(db, prop, receiver) as DbContext
        },
      })
    })
  }
}

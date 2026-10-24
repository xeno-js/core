import type {
  IBaseAuthService,
  IBaseMapper,
  Identity,
  IGateKeeper,
  ResultType,
} from '@xeno-js/shared'
import type { AuthClaims, Optional } from '@xeno-js/shared'
import { Result } from '@xeno-js/shared'
import { Guards, GUEST } from '@xeno-js/shared'

/**
 * @description The GateKeeper class is responsible for authenticating users based on their identity and permissions. It provides a method to authenticate a user using a token and returns their identity. If the token is invalid or missing, it returns a guest identity.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class GateKeeper implements IGateKeeper {
  constructor(
    private readonly _authServiceResolver: () => IBaseAuthService,
    private readonly _mapper: IBaseMapper<AuthClaims, Identity>,
  ) {}

  public async authenticate(token: Optional<string>): Promise<ResultType<Identity>> {
    const guest = GUEST as unknown as Identity
    const authService = this._authServiceResolver()
    if (!Guards.isNullOrEmpty(token)) {
      const authResult = await authService.authenticate(token)

      if (!authResult.isOk()) return Result.fail(authResult.getErrorOrThrow())

      const claims = authResult.getValueOrThrow()
      if (!Guards.isNullOrEmpty(claims)) return Result.ok(this._mapper.map(claims))

      return Result.ok(guest)
    }

    const userResult = await authService.getUser()

    if (userResult.isOk()) {
      const user = userResult.getValueOrThrow()
      if (Guards.isDefined(user)) {
        return Result.ok(this._mapper.map(user))
      }
    }

    return Result.ok(guest)
  }
}

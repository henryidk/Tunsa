import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';

@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const username = req.body?.username;
    if (username) {
      return `login_user_${username}`;
    }
    return req.ip;
  }

  protected async throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const seconds = Math.ceil(detail.timeToExpire);
    throw new ThrottlerException(
      `Demasiados intentos fallidos. Intenta nuevamente en ${seconds} segundos.`,
    );
  }
}

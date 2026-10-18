import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';

/**
 * `@nestjs/throttler` suffixes the header with the profile name (`Retry-After-public`) for named
 * throttlers; clients and proxies expect the standard `Retry-After`.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', detail.timeToBlockExpire);
    await super.throwThrottlingException(context, detail);
  }
}

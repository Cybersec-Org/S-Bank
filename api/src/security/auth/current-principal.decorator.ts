import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest, Principal } from './principal.js';

/** Injects the verified caller; fails closed when a route is reached without one. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal => {
    const { principal } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!principal) {
      throw new UnauthorizedException();
    }
    return principal;
  },
);

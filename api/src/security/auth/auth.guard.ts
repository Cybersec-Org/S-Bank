import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CLOCK, type Clock } from '../../common/clock.js';
import { resolveZone, type Zone } from '../zones.js';
import type { AuthenticatedRequest, Principal, Role } from './principal.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';
import { STEP_UP_KEY, type StepUpOptions } from './step-up.decorator.js';
import { StepUpRequiredException } from './step-up-required.exception.js';
import { isStepUpSatisfied, STEP_UP_ACR } from './step-up.js';
import { TOKEN_VERIFIER, type TokenVerifier } from './token-verifier.js';

const BEARER_TOKEN_PATTERN = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/i;

/** Zones where anonymous routes may exist. */
const ANONYMOUS_ZONES: readonly Zone[] = ['public', 'internal'];

/** Zones that stay closed to every caller for now. */
// B-26: open /partner together with mTLS (Caddy client_auth) and certificate-bound tokens.
const CLOSED_ZONES: readonly Zone[] = ['partner'];

/**
 * Global deny-by-default guard: a route is reachable only if it is `@Public()` in an anonymous
 * zone, or declares `@Roles()`, carries a valid bearer token with one of those roles and, when
 * marked `@RequireStepUp()`, a sufficiently strong and fresh authentication.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly tokenVerifier: TokenVerifier,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const zone = resolveZone(request.path);

    if (this.declaredMetadata<boolean>(IS_PUBLIC_KEY, context)) {
      this.assertAnonymousRouteAllowed(zone, context);
      return true;
    }

    const requiredRoles = this.requiredRolesOf(zone, context);
    const principal = await this.authenticate(request);
    request.principal = principal;

    if (!principal.roles.some((role) => requiredRoles.includes(role))) {
      throw new ForbiddenException();
    }
    this.assertStepUp(principal, context);
    return true;
  }

  private declaredMetadata<T>(key: string, context: ExecutionContext): T | undefined {
    return this.reflector.getAllAndOverride<T | undefined>(key, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  private assertAnonymousRouteAllowed(zone: Zone | undefined, context: ExecutionContext): void {
    if (zone === undefined || !ANONYMOUS_ZONES.includes(zone)) {
      this.logger.warn(`@Public() route outside the public zone: ${describeRoute(context)}`);
      throw new ForbiddenException();
    }
  }

  private requiredRolesOf(zone: Zone | undefined, context: ExecutionContext): readonly Role[] {
    if (zone === undefined || zone === 'internal') {
      this.logger.warn(`Non-public route outside the api zone: ${describeRoute(context)}`);
      throw new ForbiddenException();
    }
    if (CLOSED_ZONES.includes(zone)) {
      this.logger.warn(`Request to a closed zone (${zone}): ${describeRoute(context)}`);
      throw new ForbiddenException();
    }
    const roles = this.declaredMetadata<readonly Role[]>(ROLES_KEY, context);
    if (!roles || roles.length === 0) {
      this.logger.warn(`Route without access declaration: ${describeRoute(context)}`);
      throw new ForbiddenException();
    }
    return roles;
  }

  private async authenticate(request: AuthenticatedRequest): Promise<Principal> {
    const token = BEARER_TOKEN_PATTERN.exec(request.headers.authorization ?? '')?.[1];
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      return await this.tokenVerifier.verify(token);
    } catch {
      // Whatever went wrong inside the verifier, the caller only learns that the token is unusable.
      throw new UnauthorizedException();
    }
  }

  private assertStepUp(principal: Principal, context: ExecutionContext): void {
    const options = this.declaredMetadata<StepUpOptions>(STEP_UP_KEY, context);
    if (options && !isStepUpSatisfied(principal, options, this.clock.nowSeconds())) {
      throw new StepUpRequiredException(STEP_UP_ACR, options.maxAgeSeconds);
    }
  }
}

function describeRoute(context: ExecutionContext): string {
  return `${context.getClass().name}.${context.getHandler().name}`;
}

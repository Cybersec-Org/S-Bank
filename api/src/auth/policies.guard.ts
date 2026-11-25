import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Action, type AppSubjects, CaslAbilityFactory } from './casl-ability.factory.js';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface.js';

export interface RequiredRule {
  action: Action;
  subject: AppSubjects;
}

export const IS_PUBLIC_KEY = 'is_public';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const CHECK_ABILITY_KEY = 'check_ability';
export const CheckAbilities = (...requirements: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITY_KEY, requirements);

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const rules =
      this.reflector.getAllAndOverride<RequiredRule[]>(CHECK_ABILITY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('User context is missing (deny by default)');
    }

    if (rules.length === 0) {
      return true;
	    //throw new ForbiddenException('No authorization policy defined for this endpoint');
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    for (const rule of rules) {
      if (!ability.can(rule.action, rule.subject)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: `Role ${user.role} is not allowed to perform "${rule.action}" on "${String(rule.subject)}"`,
        });
      }
    }

    return true;
  }
}

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
    const rules =
      this.reflector.get<RequiredRule[]>(CHECK_ABILITY_KEY, context.getHandler()) || [];

    if (rules.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('User context is missing');
    }

    const ability = this.caslAbilityFactory.createForUser(user);

    for (const rule of rules) {
      if (!ability.can(rule.action, rule.subject)) {
        throw new ForbiddenException(
          `Role ${user.role} is not allowed to perform "${rule.action}" on "${String(rule.subject)}"`,
        );
      }
    }

    return true;
  }
}
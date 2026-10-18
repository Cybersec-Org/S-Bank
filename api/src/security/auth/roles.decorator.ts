import { SetMetadata } from '@nestjs/common';
import type { Role } from './principal.js';

export const ROLES_KEY = 'sbank:roles';

/** Declares which roles may call the route; every non-public route needs it (deny by default). */
export const Roles = (...roles: readonly Role[]) => SetMetadata(ROLES_KEY, roles);

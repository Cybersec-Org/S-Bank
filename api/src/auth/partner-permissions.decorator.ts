import { SetMetadata } from '@nestjs/common';
import type { PartnerPermission } from './interfaces/authenticated-partner.interface.js';

export const PARTNER_PERMISSIONS_KEY = 'partner_permissions';

export const RequirePartnerPermissions = (
  ...permissions: PartnerPermission[]
) => SetMetadata(PARTNER_PERMISSIONS_KEY, permissions);

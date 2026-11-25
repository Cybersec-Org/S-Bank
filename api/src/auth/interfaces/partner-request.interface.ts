
import type { Request } from 'express';
import type { AuthenticatedPartner } from './authenticated-partner.interface.js';

export interface PartnerRequest extends Request {
  partner: AuthenticatedPartner;
}


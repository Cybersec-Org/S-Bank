export enum PartnerId {
  PARTNER1 = 'partner1',
  PARTNER2 = 'partner2',
}

export type PartnerPermission =
  | 'payments:read'
  | 'reports:read';

export interface AuthenticatedPartner {
  id: PartnerId;
  permissions: PartnerPermission[];
}

export enum PartnerId {
  PARTNER1 = 'partner1',
  PARTNER2 = 'partner2',
}

export type PartnerPermission =
  | 'payments:read'
  | 'payments:create'
  | 'reports:read';

export interface AuthenticatedPartner {
  id: PartnerId;
  permissions: PartnerPermission[];
  expectedCertThumbprint?: string | undefined;
}
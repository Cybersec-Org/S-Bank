export enum Role {
  CLIENT = 'CLIENT',
  EMPLOYEE = 'EMPLOYEE',
  ADMIN = 'ADMIN',
}

export interface AuthenticatedUser {
  id: string;
  keycloakSub?: string | undefined;
  role: Role;
  ipAddress: string;
  acr?: string | undefined;
  authTime?: number | undefined;
  email?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
}
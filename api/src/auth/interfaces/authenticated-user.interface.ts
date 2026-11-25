export enum Role {
  CLIENT = 'CLIENT',
  EMPLOYEE = 'EMPLOYEE',
  ADMIN = 'ADMIN',
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
  ipAddress: string;
  acr?: string | undefined;
  authTime?: number | undefined;
  email?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
}
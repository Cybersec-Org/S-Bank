export enum Role {
  CLIENT = 'CLIENT',
  EMPLOYEE = 'EMPLOYEE',
  ADMIN = 'ADMIN',
}

export interface AuthenticatedUser {
  id: string;
  role: Role;
  ipAddress: string;
}
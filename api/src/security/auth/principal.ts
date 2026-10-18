import type { Request } from 'express';

export const ROLES = ['customer', 'employee', 'admin', 'partner'] as const;

export type Role = (typeof ROLES)[number];

/** The verified caller, built only from a token that passed signature, issuer, audience and expiry checks. */
export interface Principal {
  /** Keycloak `sub`. */
  readonly subject: string;
  readonly roles: readonly Role[];
  /** Authentication context class reference; `2` means passkey (step-up) authentication. */
  readonly acr?: string;
  /** Time of the last interactive authentication, seconds since the Unix epoch (`auth_time`). */
  readonly authTime?: number;
  /** `customers.id` of the caller; ownership rules for customers are emitted only when it is known. */
  readonly customerId?: string;
  /** Partner id bound to the client certificate; partner rules are emitted only when it is known. */
  readonly partnerId?: string;
}

export interface AuthenticatedRequest extends Request {
  principal?: Principal;
}

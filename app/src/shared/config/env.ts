import { z } from 'zod';

/**
 * `mock`: in-memory demo data. `hybrid` (development only): screens with an API counterpart talk to the dev API,
 * the rest stays on demo data, and the demo identity travels in the API's `x-user-id` / `x-user-role` headers.
 * `live`: the real API with real sign-in.
 */
export const API_MODES = ['mock', 'hybrid', 'live'] as const;
export type ApiMode = (typeof API_MODES)[number];

/**
 * Development defaults match docker-compose.yml: the API on 127.0.0.1:3000 and Keycloak 26 (`start-dev`, no `/auth`
 * prefix) with the fixed issuer from KC_HOSTNAME. Production placeholders stay https so the https rule below holds;
 * a real production build sets both URLs explicitly.
 */
const DEFAULT_URLS = {
  development: {
    apiBaseUrl: 'http://localhost:3000',
    oidcIssuerUrl: 'http://localhost:8080/realms/sbank',
  },
  production: {
    apiBaseUrl: 'https://localhost:3000',
    oidcIssuerUrl: 'https://localhost:8080/realms/sbank',
  },
} as const;
const DEFAULT_OIDC_CLIENT_ID = 'sbank-app';

const rawEnvSchema = z.object({
  apiMode: z.enum(API_MODES),
  apiBaseUrl: z.url(),
  oidcIssuerUrl: z.url(),
  oidcClientId: z.string().min(1),
});

export type AppEnv = z.infer<typeof rawEnvSchema>;

export interface RawPublicEnv {
  readonly EXPO_PUBLIC_API_MODE?: string | undefined;
  readonly EXPO_PUBLIC_API_BASE_URL?: string | undefined;
  readonly EXPO_PUBLIC_OIDC_ISSUER_URL?: string | undefined;
  readonly EXPO_PUBLIC_OIDC_CLIENT_ID?: string | undefined;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

/**
 * Validates the public configuration. Mock mode is the default only outside production builds, so a
 * production bundle without an explicit `EXPO_PUBLIC_API_MODE=mock` always runs against the live API.
 * Only variable names are reported on failure, never values.
 */
export function parseEnv(raw: RawPublicEnv, isProduction: boolean): AppEnv {
  const defaults = DEFAULT_URLS[isProduction ? 'production' : 'development'];
  const result = rawEnvSchema
    .refine((value) => !isProduction || value.apiMode !== 'hybrid', {
      path: ['apiMode'],
      message:
        'hybrid mode sends spoofable identity headers and is not allowed in production builds',
    })
    .refine((value) => !isProduction || value.apiBaseUrl.startsWith('https://'), {
      path: ['apiBaseUrl'],
      message: 'must use https in production builds',
    })
    .refine((value) => !isProduction || value.oidcIssuerUrl.startsWith('https://'), {
      path: ['oidcIssuerUrl'],
      message: 'must use https in production builds',
    })
    .safeParse({
      apiMode: emptyToUndefined(raw.EXPO_PUBLIC_API_MODE) ?? (isProduction ? 'live' : 'mock'),
      apiBaseUrl: emptyToUndefined(raw.EXPO_PUBLIC_API_BASE_URL) ?? defaults.apiBaseUrl,
      oidcIssuerUrl: emptyToUndefined(raw.EXPO_PUBLIC_OIDC_ISSUER_URL) ?? defaults.oidcIssuerUrl,
      oidcClientId: emptyToUndefined(raw.EXPO_PUBLIC_OIDC_CLIENT_ID) ?? DEFAULT_OIDC_CLIENT_ID,
    });
  if (!result.success) {
    const invalid = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid public app configuration: ${invalid}`);
  }
  return result.data;
}

/** Metro only inlines statically written `process.env.EXPO_PUBLIC_*` accesses, so each one is spelled out. */
export const env: AppEnv = parseEnv(
  {
    EXPO_PUBLIC_API_MODE: process.env.EXPO_PUBLIC_API_MODE,
    EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
    EXPO_PUBLIC_OIDC_ISSUER_URL: process.env.EXPO_PUBLIC_OIDC_ISSUER_URL,
    EXPO_PUBLIC_OIDC_CLIENT_ID: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID,
  },
  process.env.NODE_ENV === 'production',
);

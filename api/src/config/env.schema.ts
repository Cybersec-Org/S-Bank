import { z } from 'zod';
import {
  DEFAULT_API_PORT,
  DEFAULT_DAILY_LIMIT_GROSZE,
  DEFAULT_LOG_LEVEL,
  DEFAULT_NBP_API_BASE_URL,
  LOG_LEVELS,
  MAX_DAILY_LIMIT_GROSZE,
  NODE_ENVIRONMENTS,
  STEP_UP_THRESHOLD_GROSZE,
} from './defaults.js';

const MAX_TCP_PORT = 65_535;

/** Unset and empty variables are equivalent, so `KEY=` placeholders in `.env.example` work. */
function emptyToUndefined(value: unknown): unknown {
  return value === '' ? undefined : value;
}

function optionalVariable<T extends z.ZodType>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional());
}

function variableWithDefault<T extends z.ZodType>(schema: T, fallback: z.output<T>) {
  return optionalVariable(schema).transform((value) => value ?? fallback);
}

function isHttpUrl(value: string): boolean {
  return URL.canParse(value) && /^https?:$/.test(new URL(value).protocol);
}

function isPostgresUrl(value: string): boolean {
  return URL.canParse(value) && /^postgres(ql)?:$/.test(new URL(value).protocol);
}

function isOrigin(value: string): boolean {
  return isHttpUrl(value) && new URL(value).origin === value;
}

const httpUrl = z.string().refine(isHttpUrl, { error: 'must be an http(s) URL' });

function integerFromString(minimum: number, maximum: number) {
  return z
    .string()
    .regex(/^\d+$/, { error: 'must be a non-negative integer' })
    .transform(Number)
    .pipe(z.number().int().min(minimum).max(maximum));
}

/** Only the literal strings `true` and `false` are accepted, so typos fail instead of defaulting. */
const booleanFlag = z.enum(['true', 'false']).transform((value) => value === 'true');

const corsOrigins = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(
    z.array(
      z.string().refine(isOrigin, { error: 'must be an origin such as http://localhost:8081' }),
    ),
  );

export const envSchema = z.object({
  // Production unless stated otherwise: a missing variable must not switch on the Swagger UI.
  NODE_ENV: variableWithDefault(z.enum(NODE_ENVIRONMENTS), 'production'),
  API_PORT: variableWithDefault(integerFromString(1, MAX_TCP_PORT), DEFAULT_API_PORT),
  DATABASE_URL: z.string().refine(isPostgresUrl, { error: 'must be a postgres(ql):// URL' }),
  CORS_ORIGINS: variableWithDefault(corsOrigins, []),
  OIDC_ISSUER_URL: httpUrl,
  OIDC_AUDIENCE: z.string().min(1),
  OIDC_JWKS_URL: optionalVariable(httpUrl),
  LOG_LEVEL: variableWithDefault(z.enum(LOG_LEVELS), DEFAULT_LOG_LEVEL),
  // May lower the threshold but never raise it above the default (invariant 5: 1 000 zł).
  STEP_UP_THRESHOLD_GROSZE: variableWithDefault(
    integerFromString(1, STEP_UP_THRESHOLD_GROSZE),
    STEP_UP_THRESHOLD_GROSZE,
  ),
  DEFAULT_DAILY_LIMIT_GROSZE: variableWithDefault(
    integerFromString(0, MAX_DAILY_LIMIT_GROSZE),
    DEFAULT_DAILY_LIMIT_GROSZE,
  ),
  NBP_API_BASE_URL: variableWithDefault(httpUrl, DEFAULT_NBP_API_BASE_URL),
  TRUST_PROXY: variableWithDefault(booleanFlag, false),
});

export type Env = z.infer<typeof envSchema>;

/** Names the offending variables but never echoes their values (they may be secrets). */
export class EnvValidationError extends Error {
  constructor(readonly invalidVariables: readonly string[]) {
    super(`Invalid environment configuration: ${invalidVariables.join(', ')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  const invalidVariables = result.error.issues.map(
    (issue) => `${String(issue.path[0] ?? '(root)')} [${issue.code}]`,
  );
  throw new EnvValidationError([...new Set(invalidVariables)]);
}

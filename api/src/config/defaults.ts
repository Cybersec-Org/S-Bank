/** Step-up threshold: transfers from 1 000 zł need a fresh passkey authentication (AGENTS.md #5). */
export const STEP_UP_THRESHOLD_GROSZE = 100_000;

/** Default daily transfer limit: 5 000 zł. */
export const DEFAULT_DAILY_LIMIT_GROSZE = 500_000;

/** Upper bound for any daily limit; mirrors the CHECK constraint on `accounts.daily_limit_grosze`. */
export const MAX_DAILY_LIMIT_GROSZE = 5_000_000;

/** Fixed NBP Web API base URL; the API never builds outbound URLs from user input. */
export const DEFAULT_NBP_API_BASE_URL = 'https://api.nbp.pl/api';

export const DEFAULT_API_PORT = 3000;

export const DEFAULT_LOG_LEVEL = 'info';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;

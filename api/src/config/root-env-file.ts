import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { expand } from 'dotenv-expand';

/** Repository-root dotenv file (src/config and dist/config are both three levels below the root). */
export const ROOT_ENV_FILE_PATH = fileURLToPath(new URL('../../../.env', import.meta.url));

/** Production receives its configuration from the orchestrator only, never from a file. */
export function isRootEnvFileEnabled(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}

/**
 * Loads the root dotenv file into `process.env` for tools outside Nest (Prisma CLI, scripts).
 * Variables already set in the environment win over the file; `${VAR}` references are expanded.
 * The API itself loads the same file through `ConfigModule` with `expandVariables`.
 * A missing file is normal (CI, containers); any other read error is reported.
 */
export function loadRootEnvFile(): void {
  if (!isRootEnvFileEnabled(process.env['NODE_ENV'])) {
    return;
  }
  // Parse into a scratch object so `expand` sees the unexpanded file, not half-applied values.
  const { parsed, error } = config({ path: ROOT_ENV_FILE_PATH, processEnv: {}, quiet: true });
  if (error && !('code' in error && error.code === 'ENOENT')) {
    throw error;
  }
  if (parsed) {
    expand({ parsed });
  }
}

import { randomBytes } from 'node:crypto';
import { readFile, writeFile, chmod, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
const tempPath = `${envPath}.tmp`;

const secrets = [
  'POSTGRES_PASSWORD',
  'KEYCLOAK_ADMIN_PASSWORD',
  'PARTNER_PROXY_TOKEN',
];

function generateSecret() {
  return randomBytes(32).toString('base64url');
}

function isPlaceholder(value) {
  return !value || /^(CHANGE_ME|REPLACE_ME|TODO)$/i.test(value.trim());
}

async function main() {
  let content;

  try {
    content = await readFile(envPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Brak pliku .env. Najpierw utwórz go na podstawie .env.example.');
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  const lines = content.split(/\r?\n/);
  const existing = new Map();

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*([A-Z0-9_]+)\s*=/);
    if (!match) continue;

    const key = match[1];

    if (existing.has(key)) {
      throw new Error(`Powielona zmienna ${key} w .env. Usuń duplikat.`);
    }

    existing.set(key, i);
  }

  let generated = 0;

  for (const key of secrets) {
    const index = existing.get(key);

    if (index === undefined) {
      lines.push(`${key}=${generateSecret()}`);
      generated++;
      console.log(`Dodano sekret: ${key}`);
      continue;
    }

    const value = lines[index].slice(lines[index].indexOf('=') + 1);

    if (isPlaceholder(value)) {
      lines[index] = `${key}=${generateSecret()}`;
      generated++;
      console.log(`Wygenerowano sekret: ${key}`);
    } else {
      console.log(`Zachowano istniejący sekret: ${key}`);
    }
  }

  const output = lines.join('\n').replace(/\n*$/, '\n');

  await writeFile(tempPath, output, { mode: 0o600 });
  await rename(tempPath, envPath);
  await chmod(envPath, 0o600);

  console.log(`\nGotowe. Wygenerowano ${generated} sekretów.`);
  console.log('Plik .env ma uprawnienia 600.');
}

main().catch(async (error) => {
  console.error('Błąd:', error.message);
  process.exitCode = 1;
});

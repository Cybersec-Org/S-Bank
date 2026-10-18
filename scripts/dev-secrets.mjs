#!/usr/bin/env node
/**
 * Creates the git-ignored root `.env` from `.env.example` for local development and CI.
 *
 * - Every value equal to `__GENERATE__` is replaced with 32 random bytes (base64url).
 * - All other lines are copied as they are (defaults, comments, empty values).
 * - An existing `.env` is never overwritten: delete it yourself to regenerate.
 * - Generated values are never printed; only the variable names are listed.
 *
 * Usage: node scripts/dev-secrets.mjs
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GENERATE_MARKER = '__GENERATE__';
const SECRET_BYTES = 32;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examplePath = path.join(rootDir, '.env.example');
const envPath = path.join(rootDir, '.env');

function generateSecret() {
  return randomBytes(SECRET_BYTES).toString('base64url');
}

function main() {
  if (!existsSync(examplePath)) {
    console.error('dev-secrets: .env.example not found — run /bootstrap-project first.');
    process.exit(1);
  }
  if (existsSync(envPath)) {
    console.log(
      'dev-secrets: .env already exists — nothing to do. Delete it manually to regenerate.',
    );
    return;
  }

  const generated = [];
  const lines = readFileSync(examplePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => {
      const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (!match || match[2].trim() !== GENERATE_MARKER) return line;
      generated.push(match[1]);
      return `${match[1]}=${generateSecret()}`;
    });

  writeFileSync(envPath, `${lines.join('\n').trimEnd()}\n`, { mode: 0o600, flag: 'wx' });
  console.log(
    `dev-secrets: created .env with ${generated.length} generated secret(s): ${generated.join(', ') || '(none)'}`,
  );
}

main();

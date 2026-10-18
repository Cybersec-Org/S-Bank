#!/usr/bin/env node
/**
 * PreToolUse guard for Bash/PowerShell commands.
 *
 * Repository policy (AGENTS.md): agents never change Git state, never write to
 * GitHub through `gh`, never publish packages, never pipe a download into an
 * interpreter and never read or overwrite secret files. Permission rules in
 * settings.json cover the common spellings; this hook also catches wrapped
 * forms such as `git -C . commit`, `sh -c "…"`, `$(…)` and command chains.
 *
 * Output: a JSON "deny" decision on stdout, or nothing when the command is fine.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MAX_NESTING = 4;

const GIT_READ_ONLY = new Set([
  'status',
  'diff',
  'log',
  'show',
  'blame',
  'grep',
  'ls-files',
  'ls-tree',
  'ls-remote',
  'rev-parse',
  'rev-list',
  'describe',
  'shortlog',
  'cat-file',
  'show-ref',
  'for-each-ref',
  'whatchanged',
  'name-rev',
  'merge-base',
  'cherry',
  'range-diff',
  'var',
  'help',
  'version',
  'check-ignore',
  'check-attr',
  'count-objects',
  'verify-commit',
  'verify-tag',
  'fetch',
  'clone',
  'archive',
  'format-patch',
  'difftool',
  'show-branch',
]);

const GIT_GLOBAL_OPTIONS_WITH_VALUE = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--exec-path',
  '--config-env',
  '--super-prefix',
]);

const positional = (args) => args.filter((arg) => !arg.startsWith('-'));
const hasAny = (args, pattern) => args.some((arg) => pattern.test(arg));

/** Git subcommands that are read-only only with specific arguments. */
const GIT_CONDITIONAL = {
  branch: (args) =>
    !hasAny(
      args,
      /^(-d|-D|--delete|-m|-M|--move|-c|-C|--copy|-f|--force|-u|--set-upstream-to.*|--unset-upstream|--edit-description|-t|--track.*|--no-track|--create-reflog)$/,
    ) &&
    (positional(args).length === 0 ||
      hasAny(args, /^(-l|--list|--contains|--no-contains|--merged|--no-merged|--points-at)$/)),
  tag: (args) =>
    !hasAny(
      args,
      /^(-a|--annotate|-s|--sign|-u|--local-user.*|-f|--force|-d|--delete|-m|--message.*|-F|--file.*|-e|--edit)$/,
    ) &&
    (positional(args).length === 0 ||
      hasAny(args, /^(-l|--list|--contains|--no-contains|--points-at|-n\d*)$/)),
  config: (args) =>
    !hasAny(
      args,
      /^(--unset.*|--add|--replace-all|--rename-section|--remove-section|-e|--edit|set|unset|rename-section|remove-section|edit)$/,
    ) &&
    (hasAny(args, /^(--get.*|-l|--list|get|list)$/) || positional(args).length <= 1),
  remote: (args) => args.length === 0 || ['-v', '--verbose', 'show', 'get-url'].includes(args[0]),
  stash: (args) => ['list', 'show'].includes(args[0]),
  worktree: (args) => args[0] === 'list',
  reflog: (args) => args.length === 0 || args[0] === 'show',
  submodule: (args) => args.length === 0 || args[0] === 'status',
  'symbolic-ref': (args) => positional(args).length <= 1,
};

/** gh command groups and the actions allowed in them (null = whole group is read-only). */
const GH_READ_ONLY = {
  pr: ['list', 'view', 'diff', 'checks', 'status'],
  issue: ['list', 'view', 'status'],
  run: ['list', 'view', 'watch', 'download'],
  workflow: ['list', 'view'],
  repo: ['view', 'list'],
  release: ['list', 'view'],
  label: ['list'],
  secret: ['list'],
  variable: ['list'],
  auth: ['status'],
  search: null,
  status: null,
  browse: null,
  version: null,
  '--version': null,
};

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'pwsh', 'powershell', 'cmd']);
const INTERPRETERS = new Set([
  ...SHELLS,
  'python',
  'python3',
  'node',
  'perl',
  'ruby',
  'php',
  'iex',
  'invoke-expression',
]);
const DOWNLOADERS = new Set([
  'curl',
  'wget',
  'iwr',
  'irm',
  'invoke-webrequest',
  'invoke-restmethod',
]);
const WRAPPERS = new Set([
  'sudo',
  'env',
  'command',
  'builtin',
  'exec',
  'nohup',
  'time',
  'timeout',
  'nice',
  'ionice',
  'stdbuf',
  'noglob',
  'xargs',
  'watch',
]);
/** Programs that may name a secret path without reading its contents. */
const SAFE_WITH_SECRET_PATHS = new Set([
  'ls',
  'test',
  '[',
  'stat',
  'file',
  'chmod',
  'mkdir',
  'openssl',
  'ssh-keygen',
  'docker',
  'echo',
  'printf',
]);

const SECRET_EXAMPLE_FILE = /^\.env\.(example|sample|template)$/i;
const REDIRECTION_TARGET = /\d*(?:>>?|<)&?\s*("[^"]*"|'[^']*'|[^\s;&|()]+)/g;

/** True when a path-like token points at a secret the agent must neither read nor write. */
function isSecretPath(rawToken) {
  const token = rawToken.replace(/^\d*[<>]+&?/, '');
  const value = token.includes('=') ? token.slice(token.indexOf('=') + 1) : token;
  const normalized = value.replace(/\\/g, '/').replace(/^['"]|['"]$/g, '');
  const base = path.posix.basename(normalized);
  if (SECRET_EXAMPLE_FILE.test(base)) return false;
  if (/^\.env(\..+)?$/i.test(base)) return true;
  if (/\.(pem|key|p12|pfx|jks|keystore)$/i.test(base)) return true;
  if (/^id_(rsa|ed25519|ecdsa)$/i.test(base)) return true;
  return /(^|\/)infra\/secrets(\/|$)|(^|\/)softhsm\/tokens(\/|$)/.test(normalized);
}

/** Splits a command line into segments with the operator that precedes each one. */
function splitSegments(command) {
  const segments = [];
  let current = '';
  let quote = null;
  let operatorBefore = null;
  const flush = (nextOperator) => {
    if (current.trim() !== '') segments.push({ text: current, operatorBefore });
    current = '';
    operatorBefore = nextOperator;
  };
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];
    if (quote) {
      current += ch;
      if (ch === '\\' && quote === '"' && next !== undefined) {
        current += next;
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '\\' && next !== undefined) {
      current += ch + next;
      i += 1;
      continue;
    }
    const pair = ch + (next ?? '');
    if (pair === '&&' || pair === '||' || pair === '|&') {
      flush(pair);
      i += 1;
      continue;
    }
    if (ch === '&' && (command[i - 1] === '>' || next === '>')) {
      current += ch;
      continue;
    }
    if (ch === ';' || ch === '\n' || ch === '&' || ch === '|') {
      flush(ch);
      continue;
    }
    current += ch;
  }
  flush(null);
  return segments;
}

/** Shell-like tokenizer: handles quotes and escapes, drops bare redirection operators. */
function tokenize(segment) {
  const tokens = [];
  let current = '';
  let quote = null;
  let inToken = false;
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < segment.length) {
        current += segment[i + 1];
        i += 1;
      } else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      inToken = true;
      continue;
    }
    if (ch === '\\' && i + 1 < segment.length) {
      current += segment[i + 1];
      i += 1;
      inToken = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (inToken) tokens.push(current);
      current = '';
      inToken = false;
      continue;
    }
    current += ch;
    inToken = true;
  }
  if (inToken) tokens.push(current);
  return tokens.filter((token) => !/^\d*[<>]{1,2}&?\d*$/.test(token));
}

/** Command strings nested in $(…) and backticks. */
function nestedCommands(command) {
  const nested = [];
  for (const match of command.matchAll(/\$\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g))
    nested.push(match[1]);
  for (const match of command.matchAll(/`([^`]*)`/g)) nested.push(match[1]);
  return nested;
}

function programName(token) {
  return path
    .basename(token.replace(/\\/g, '/'))
    .replace(/\.(exe|cmd|bat|ps1)$/i, '')
    .toLowerCase();
}

/** Drops leading env assignments and wrapper programs (sudo, env, timeout 10, xargs -n1 …). */
function unwrap(tokens) {
  let rest = [...tokens];
  for (;;) {
    while (rest.length > 0 && /^[A-Za-z_][A-Za-z0-9_]*=/.test(rest[0])) rest = rest.slice(1);
    if (rest.length === 0 || !WRAPPERS.has(programName(rest[0]))) return rest;
    rest = rest.slice(1);
    while (rest.length > 0 && (rest[0].startsWith('-') || /^\d+[smhd]?$/.test(rest[0])))
      rest = rest.slice(1);
  }
}

function checkGit(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) {
    const option = args[i].split('=')[0];
    i += GIT_GLOBAL_OPTIONS_WITH_VALUE.has(option) && !args[i].includes('=') ? 2 : 1;
  }
  const subcommand = args[i];
  if (subcommand === undefined || GIT_READ_ONLY.has(subcommand)) return null;
  if (GIT_CONDITIONAL[subcommand]?.(args.slice(i + 1))) return null;
  return `\`git ${subcommand}\` changes repository state. Git write operations are reserved for the project owner (AGENTS.md › Git and change policy). Leave the changes in the working tree and hand over with the prepare-commit skill.`;
}

function checkGh(args) {
  const [group, action] = args;
  if (group === undefined) return null;
  if (group === 'api') {
    const writes = args.some(
      (arg, idx) =>
        (/^(-X|--method)$/.test(arg) && !/^get$/i.test(args[idx + 1] ?? '')) ||
        /^--method=(?!get$)/i.test(arg) ||
        /^(-f|-F|--field|--raw-field|--input)$/.test(arg),
    );
    return writes ? '`gh api` write requests are reserved for the project owner.' : null;
  }
  if (!Object.hasOwn(GH_READ_ONLY, group))
    return `\`gh ${group}\` is not on the read-only allowlist; GitHub changes are reserved for the project owner.`;
  const allowed = GH_READ_ONLY[group];
  if (allowed === null || allowed.includes(action)) return null;
  return `\`gh ${group} ${action ?? ''}\` would change GitHub state; that is reserved for the project owner.`;
}

function checkDocker(args) {
  const isCompose = args[0] === 'compose';
  const rest = isCompose ? args.slice(1) : args;
  let i = 0;
  while (i < rest.length && rest[i].startsWith('-')) {
    i +=
      /^(-f|--file|-p|--project-name|--env-file|--profile|--project-directory|-c|--context|-H|--host)$/.test(
        rest[i],
      )
        ? 2
        : 1;
  }
  const subcommand = rest[i];
  const subArgs = rest.slice(i + 1);
  if (
    isCompose &&
    subcommand === 'config' &&
    !hasAny(subArgs, /^(-q|--quiet|--services|--volumes|--profiles|--images)$/)
  ) {
    return '`docker compose config` prints resolved secrets from .env. Validate with `docker compose config --quiet` instead.';
  }
  if (subcommand === 'inspect' && !hasAny(subArgs, /^(-f|--format.*)$/)) {
    return '`docker inspect` without --format prints container environment variables (secrets). Pass --format with the fields you need.';
  }
  if ((subcommand === 'exec' || subcommand === 'run') && hasAny(subArgs, /^(env|printenv)$/)) {
    return 'Printing a container environment would expose secrets.';
  }
  return null;
}

function checkSegment(segment, previousProgram) {
  for (const match of segment.text.matchAll(REDIRECTION_TARGET)) {
    if (isSecretPath(match[1]))
      return 'Redirecting into or out of a secret file (.env, key, certificate store) is not allowed. Secrets are handled by the user only.';
  }
  const command = unwrap(tokenize(segment.text));
  if (command.length === 0) return null;
  const name = programName(command[0]);
  const args = command.slice(1);

  const specific =
    (name === 'git' && checkGit(args)) ||
    (name === 'gh' && checkGh(args)) ||
    (name === 'docker' && checkDocker(args)) ||
    (name === 'docker-compose' && checkDocker(['compose', ...args])) ||
    (['npm', 'pnpm', 'yarn', 'bun'].includes(name) &&
      args[0] === 'publish' &&
      'Publishing packages is reserved for the project owner.');
  if (specific) return specific;

  if (
    INTERPRETERS.has(name) &&
    DOWNLOADERS.has(previousProgram ?? '') &&
    segment.operatorBefore?.startsWith('|')
  ) {
    return 'Piping a download straight into an interpreter is not allowed. Download, inspect and verify the file first, or use the package manager.';
  }
  if (!SAFE_WITH_SECRET_PATHS.has(name) && args.some(isSecretPath)) {
    return 'This command would read or change a secret file (.env, private key, certificate store). Secrets are handled by the user only; ask them to set or check the value.';
  }
  return null;
}

function analyze(command, depth = 0) {
  if (depth > MAX_NESTING) return 'Command nesting is too deep to verify.';
  let previousProgram = null;
  for (const segment of splitSegments(command)) {
    const reason = checkSegment(segment, previousProgram);
    if (reason) return reason;
    const tokens = unwrap(tokenize(segment.text));
    const name = tokens.length > 0 ? programName(tokens[0]) : '';
    if (SHELLS.has(name)) {
      const flagIndex = tokens.findIndex((token) => /^(-c|-lc|-ic|-Command|\/c)$/i.test(token));
      const inner = flagIndex === -1 ? undefined : tokens[flagIndex + 1];
      if (inner) {
        const innerReason = analyze(inner, depth + 1);
        if (innerReason) return innerReason;
      }
    }
    if ((name === 'eval' || name === 'iex' || name === 'invoke-expression') && tokens.length > 1) {
      const innerReason = analyze(tokens.slice(1).join(' '), depth + 1);
      if (innerReason) return innerReason;
    }
    previousProgram = name;
  }
  for (const inner of nestedCommands(command)) {
    const reason = analyze(inner, depth + 1);
    if (reason) return reason;
  }
  return null;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    process.stderr.write('guard-bash: could not parse hook input\n');
    process.exit(2);
  }
  const command = input?.tool_input?.command;
  if (typeof command !== 'string' || command.trim() === '') return;
  const reason = analyze(command);
  if (!reason) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Blocked by repository policy: ${reason}`,
      },
    }),
  );
}

main();

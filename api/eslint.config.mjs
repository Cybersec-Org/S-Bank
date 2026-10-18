import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import security from 'eslint-plugin-security';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/**', 'build/**', 'coverage/**', 'src/generated/**'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-console': 'error',
    },
  },
  {
    // Command-line scripts may print to the console; the application never does.
    files: ['scripts/**/*.ts', 'prisma/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // Specs hand decorated prototype methods to the code under test as route handlers.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  {
    // The flat config itself is plain JavaScript outside the TypeScript project.
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);

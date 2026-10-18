const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');

const typeCheckedFiles = ['**/*.ts', '**/*.tsx'];

// eslint-config-expo already registers the @typescript-eslint plugin (a different patch release than
// typescript-eslint's own copy), so only the rule set is taken from typescript-eslint to avoid a clash.
const recommendedTypeCheckedRules = tseslint.configs.recommendedTypeChecked.at(-1).rules;

module.exports = defineConfig([
  globalIgnores([
    'dist/**',
    'dist-native/**',
    '.expo/**',
    'android/**',
    'ios/**',
    'coverage/**',
    'src/shared/api/schema.d.ts',
  ]),
  expoConfig,
  {
    files: typeCheckedFiles,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      ...recommendedTypeCheckedRules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', minimumDescriptionLength: 10 },
      ],
      'no-console': 'error',
      // SR-09: browsers have no storage that is safe for tokens or financial data.
      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message: 'Never store tokens or financial data in browser storage.',
        },
        {
          name: 'sessionStorage',
          message: 'Never store tokens or financial data in browser storage.',
        },
      ],
    },
  },
  {
    // Features talk to each other only through the other feature's index.ts.
    files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Import another feature only through its index.ts; promote shared code to src/shared.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: { globals: { __dirname: 'readonly' } },
    rules: { 'no-console': 'error' },
  },
]);

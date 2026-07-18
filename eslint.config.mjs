import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import-x';
import unicornPlugin from 'eslint-plugin-unicorn';
import globals from 'globals';

export default tseslint.config(
  // ── Global ignores ──
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.js', '*.mjs', '*.cjs'],
  },

  // ── Base JS recommended ──
  eslint.configs.recommended,

  // ── TypeScript strict + stylistic ──
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ── Prettier (disables formatting rules) ──
  prettierConfig,

  // ── Main config for TS source files ──
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      // ── TypeScript Strict ──
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/return-await': ['error', 'always'],

      // ── Import hygiene ──
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-duplicates': 'error',
      'import-x/no-unresolved': 'off', // TypeScript handles this
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      'import-x/no-mutable-exports': 'error',

      // ── Unicorn (modernisation & quality) ──
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/no-array-reduce': 'warn',
      'unicorn/no-null': 'off', // Express/DB usage requires null
      'unicorn/prevent-abbreviations': 'off', // req/res/err are idiomatic
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      'unicorn/prefer-top-level-await': 'off', // Not all entry points support TLA
      'unicorn/no-process-exit': 'warn',

      // ── General quality ──
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'off', // handled by import-x
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-throw-literal': 'error',
      'no-return-await': 'off', // superseded by @typescript-eslint/return-await
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForInStatement',
          message: 'Use for...of or Object.keys/entries instead of for...in.',
        },
      ],
    },
  },
);

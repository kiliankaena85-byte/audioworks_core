import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.aistudio/**',
      '.playwright-cli/**',
      '.data/**',
      'public/**',
      'server.js',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-constant-binary-expression': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
    },
  },
];

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import i18next from 'eslint-plugin-i18next';
import noSecrets from 'eslint-plugin-no-secrets';
import sonarjs from 'eslint-plugin-sonarjs';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    plugins: {
      i18next,
      'no-secrets': { rules: noSecrets.rules },
      sonarjs: sonarjs,
    },
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',

      // Extreme Type Strictness
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',

      // i18n Enforcement: all literal strings flagged except infrastructure
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'all',
          'should-validate-template': true,
          words: {
            exclude: ['[0-9!-/:-@\\[-`{-~]+', '[A-Z_-]+', 'dummy', 'pt-BR'],
          },
          callees: {
            exclude: [
              'require',
              'includes',
              'indexOf',
              'endsWith',
              'startsWith',
              'addEventListener',
              'removeEventListener',
              'Logger.*',
              'logger.*',
              'console.*',
              'logOperation',
              'handleError',
              'getResourceName',
              'get',
              'join',
              'split',
              'replace',
              'listen',
              'send',
              'publish',
              'putItem',
              'getItem',
              'getObject',
              'upload',
              'query',
              'forRoot',
              'register',
              'setup',
              'setGlobalPrefix',
              'setTitle',
              'setDescription',
              'setVersion',
              'addTag',
              'Controller',
              'Get',
              'Post',
              'Put',
              'Delete',
              'Patch',
              'Version',
              'Param',
              'Body',
              'Query',
              'Header',
              'ApiTags',
              'ApiProperty',
              'ApiOperation',
              'ApiBody',
              'ApiResponse',
              'ApiParam',
              'ApiHeader',
              'BadRequestException',
              'NotFoundException',
              'InternalServerErrorException',
              'RegExp',
              'existsSync',
              'mkdirSync',
              'appendFileSync',
              'readFileSync',
              'translate',
              't',
            ],
          },
          'object-properties': {
            exclude: [
              '[A-Z_-]+',
              'summary',
              'description',
              'example',
              'name',
              'type',
              'required',
              'status',
              'schema',
            ],
          },
        },
      ],

      // Naming Conventions (SOLID)
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
          prefix: ['I'],
        },
      ],

      // Hardcoded Secret Detection
      'no-secrets/no-secrets': 'error',

      // Architectural Shield (SOLID / SRP)
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'sonarjs/no-duplicate-string': 'warn',
      'sonarjs/no-identical-functions': 'error',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.int-spec.ts'],
    rules: {
      'i18next/no-literal-string': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'max-lines': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'eslint.config.mjs',
      'jest-unit.json',
      'jest-int.json',
      'test/**',
      '.releaserc.json',
    ],
  },
);

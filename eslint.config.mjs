import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // A pasta compartilhada roda no navegador e no Node: sem framework nem banco.
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
              bannedExternalImports: ['@angular/*', '@nestjs/*', 'dexie', 'rxjs', 'rxjs/*'],
            },
            { sourceTag: 'type:models', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:domain', onlyDependOnLibsWithTags: ['type:models'] },
            { sourceTag: 'type:export', onlyDependOnLibsWithTags: ['type:models', 'type:domain'] },
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:shared', 'scope:web'] },
            { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:shared', 'scope:api'] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
];

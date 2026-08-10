import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { sharedRules, typeCheckedRules } from '@max-health-inc/config/eslint/rules'

export default tseslint.config(
  { ignores: ['dist', '**/dist/**', 'node_modules', '**/node_modules/**', 'coverage', 'vitest.config.ts', 'vite.config.ts', 'vite-plugin-templates.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Org-wide baseline (@max-health-inc/config)
      ...sharedRules,
      ...typeCheckedRules,

      // React
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Guido additions on top of the baseline
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      // Type safety - gradually tighten these
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
    },
  },
)

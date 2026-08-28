import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(rounded-(lg|xl|md|full|2xl))/]",
          message: 'Tailwind radius classes (rounded-lg/xl/md/full/2xl) are forbidden. Use rounded-[var(--radius)] or rounded-none to maintain design system consistency.',
        },
        {
          selector: "JSXAttribute[name.name='className'] Literal[value=/(bg|text|border)-(pass|fail|risk|waive|sel)\\/\\d+/]",
          message: 'Opacity-suffixed status/selection fill utilities (bg-pass/*, bg-fail/*, etc.) should only be in design system primitives. Use StatusStrokeCard, StatusChip, ToggleTag, Meter, or Ledger components instead.',
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(rounded-(lg|xl|md|full|2xl))/]",
          message: 'Tailwind radius classes (rounded-lg/xl/md/full/2xl) are forbidden. Use rounded-[var(--radius)] or rounded-none to maintain design system consistency.',
        },
        {
          selector: "JSXAttribute[name.name='className'] TemplateElement[value.raw=/(bg|text|border)-(pass|fail|risk|waive|sel)\\/\\d+/]",
          message: 'Opacity-suffixed status/selection fill utilities (bg-pass/*, bg-fail/*, etc.) should only be in design system primitives. Use StatusStrokeCard, StatusChip, ToggleTag, Meter, or Ledger components instead.',
        },
      ],
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])

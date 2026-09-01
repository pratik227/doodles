import { defineConfig } from 'eslint/config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'
import markdown from '@eslint/markdown'
import reactHooks from 'eslint-plugin-react-hooks'

import type { ESLint } from 'eslint'
import tseslint from 'typescript-eslint'

export default defineConfig(
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        // The React wrapper is the only place hooks live.
        files: ['src/react/**/*.tsx'],
        plugins: {
            // The plugin still ships the legacy `configs.flat` nesting, which
            // ESLint 10's own Plugin type no longer describes. The rules
            // themselves are fine -- only the config bundle is mistyped.
            'react-hooks': reactHooks as unknown as ESLint.Plugin,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
    {
        files: ['docs/**/*.md', 'README.md'],
        plugins: {
            markdown,
        },
        extends: ['markdown/recommended'],
        rules: {
            'no-irregular-whitespace': 'off',
            'markdown/no-missing-label-refs': 'off',
        }
    },
    [
        globalIgnores([
            'dist/**',      // the built playground
            'lib/**',       // the built library
            'out/**',       // rendered SVGs
            'node_modules/**',
        ])
    ],
    {
        rules: {
            'brace-style': [
                'error',
                '1tbs',
                { 'allowSingleLine': false },
            ],
            'no-console': 'off',
            // 'no-ternary': 'error',
            'newline-before-return': 'error',
            'semi': ['error', 'never'],
            'quotes': ['error', 'single'],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn', {
                    'argsIgnorePattern': '^_|_',
                    'vars': 'all',
                    'args': 'after-used',
                    'ignoreRestSiblings': false,
                    'varsIgnorePattern': '^I[A-Z]|^_',
                }
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/triple-slash-reference': ['error', {
                'path': 'always'
            }]
        }
    },
)
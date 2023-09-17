module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:import/recommended',
    'react-app',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'plugin:prettier/recommended',
  ],
  env: {
    es6: true,
    browser: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    ecmaFeatures: {
      jsx: true,
    },
    sourceType: 'module',
  },
  rules: {
    // JavaScript rules
    curly: ['error', 'multi-line'],
    'eol-last': 'error',
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-eval': 'error',
    'no-labels': 'error',
    'no-lonely-if': 'error',
    'no-multiple-empty-lines': 'error',
    'no-new-wrappers': 'error',
    'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['acc'] }],
    'no-prototype-builtins': 'off',
    'no-trailing-spaces': ['error', { ignoreComments: true }],
    'no-undef-init': 'error',
    'no-undef': 'off',
    'no-underscore-dangle': 'error',
    'no-unneeded-ternary': 'error',
    'no-useless-computed-key': 'error',
    'no-useless-constructor': 'error',
    'no-useless-return': 'error',
    'no-var': 'error',
    'one-var': ['error', 'never'],
    'operator-linebreak': [
      'error',
      'after',
      {
        overrides: {
          '?': 'ignore',
          ':': 'ignore',
        },
      },
    ],
    'prefer-const': 'error',
    'prefer-object-spread': 'error',
    'quote-props': ['error', 'as-needed'],
    quotes: ['error', 'single'],
    radix: 'error',
    'padding-line-between-statements': [
      'error',
      // Always require blank lines after directive (like 'use-strict'), except between directives
      {
        blankLine: 'always',
        next: '*',
        prev: 'directive',
      },
      {
        blankLine: 'any',
        next: 'directive',
        prev: 'directive',
      },
      // Always require blank lines after import, except between imports
      {
        blankLine: 'always',
        next: '*',
        prev: 'import',
      },
      {
        blankLine: 'any',
        next: 'import',
        prev: 'import',
      },
    ],
    'spaced-comment': ['error', 'always', { markers: ['/'] }],

    // Import rules
    'import/default': 'off',
    'import/namespace': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/no-named-as-default-member': 'off',
    'import/no-named-as-default': 'off',
    'import/no-unresolved': 'error',
    'import/order': [
      'error',
      {
        alphabetize: {
          order: 'asc', // Sort in ascending order
        },
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        'newlines-between': 'always',
      },
    ],
    'import/prefer-default-export': 'off',

    // React rules
    'react-hooks/exhaustive-deps': 'error',
    'react-hooks/rules-of-hooks': 'error',
    'react/display-name': 'off',
    'react/jsx-uses-react': 'off', // React no longer needs to be in scope with React 17+
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off', // React no longer needs to be in scope with React 17+
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  overrides: [
    {
      files: ['**/*.?(c|m)ts?(x)'],
      extends: ['plugin:import/typescript', 'plugin:@typescript-eslint/recommended'],
      parser: '@typescript-eslint/parser',
      settings: {
        'import/resolver': {
          typescript: {},
        },
        'import/extensions': ['.cjs', '.mjs', '.js', '.jsx', '.ts', '.tsx', '.cts', '.mts'],
      },
      // If adding a typescript-eslint version of an existing ESLint rule,
      // make sure to disable the ESLint rule here.
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
        'no-loop-func': 'off',
        '@typescript-eslint/no-loop-func': 'error',
        '@typescript-eslint/no-var-requires': 'error',
        '@typescript-eslint/no-this-alias': 'error',
        'no-unused-expressions': 'off',
        '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
        'dot-notation': 'off',
        '@typescript-eslint/dot-notation': ['error'],
        '@typescript-eslint/prefer-optional-chain': 'error',
        '@typescript-eslint/no-use-before-define': 'off',
        quotes: 'off',
        '@typescript-eslint/quotes': ['error', 'single'],
        'comma-dangle': 'off',
        '@typescript-eslint/comma-dangle': [
          'error',
          {
            arrays: 'always-multiline',
            objects: 'always-multiline',
            imports: 'always-multiline',
            exports: 'always-multiline',
            enums: 'always-multiline',
            functions: 'never',
          },
        ],
      },
    },
    {
      files: ['**/*.+(spec|test).*'],
      extends: ['plugin:jest/recommended', 'plugin:jest/style'],
      env: {
        jest: true,
      },
    },
  ],
};

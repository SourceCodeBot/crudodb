module.exports = {
  env: {
    browser: true,
    node: true
  },
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:jest/recommended',
    'prettier',
    'prettier/@typescript-eslint'
  ],
  plugins: ['@typescript-eslint', 'ban', 'unused-imports', 'jest'],
  rules: {
    '@typescript-eslint/adjacent-overload-signatures': 'error',
    '@typescript-eslint/await-thenable': 'off', // High performance impact
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      {
        accessibility: 'explicit',
        overrides: {
          constructors: 'off',
          accessors: 'off'
        }
      }
    ],
    '@typescript-eslint/member-ordering': [
      'error',
      {
        default: {
          memberTypes: [
            'static-field',
            'instance-field',
            'static-method',
            'constructor',
            'instance-method'
          ]
        }
      }
    ],
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/no-for-in-array': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-param-reassign': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    'no-unused-expressions': ['off'],
    '@typescript-eslint/no-unused-expressions': [
      'warn',
      {
        allowShortCircuit: true
      }
    ],
    '@typescript-eslint/prefer-for-of': 'off',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/promise-function-async': 'off',
    '@typescript-eslint/triple-slash-reference': 'error',
    '@typescript-eslint/unified-signatures': 'error',
    'arrow-parens': ['off', 'always'],
    camelcase: 'off',
    'comma-dangle': 'off',
    'constructor-super': 'error',
    curly: 'error',
    'eol-last': 'off',
    'guard-for-in': 'error',
    'id-blacklist': 'off',
    'id-match': 'off',
    'no-unused-vars': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/no-internal-modules': 'off',
    'import/no-unassigned-import': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'import/no-useless-path-segments': 'off',
    'import/no-self-import': 'off',
    'import/named': 'off',
    'import/no-cycle': 'off',
    'import/no-duplicates': 'off',
    'import/prefer-default-export': 'off',
    'import/export': 'warn',
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        },
        groups: [
          ['builtin', 'external'],
          'internal',
          'parent',
          'sibling',
          'index',
          'object'
        ],
        pathGroupsExcludedImportTypes: []
      }
    ],
    'linebreak-style': 'off',
    'max-len': 'off',
    'new-parens': 'off',
    'newline-per-chained-call': 'off',
    'no-bitwise': 'error',
    'no-caller': 'error',
    'no-cond-assign': 'error',
    'no-console': [
      'error',
      {
        allow: [
          'error',
          'info',
          'warn',
          'group',
          'groupEnd',
          'groupCollapsed',
          'time',
          'timeEnd'
        ]
      }
    ],
    'no-debugger': 'error',
    'no-duplicate-case': 'error',
    'no-eval': 'error',
    'no-fallthrough': 'error',
    'no-invalid-this': 'off',
    'no-irregular-whitespace': 'off',
    'no-multiple-empty-lines': 'off',
    'no-new-wrappers': 'error',
    'no-redeclare': 'error',
    'no-return-await': 'error',
    'no-sequences': 'error',
    'no-shadow': [
      'error',
      {
        hoist: 'all'
      }
    ],
    'no-sparse-arrays': 'error',
    'no-template-curly-in-string': 'error',
    'no-throw-literal': 'error',
    'no-trailing-spaces': 'off',
    'no-underscore-dangle': 'off',
    'no-unsafe-finally': 'error',
    'no-unused-labels': 'error',
    'no-useless-constructor': 'off',
    'no-restricted-globals': 'off',
    'no-empty-function': [
      'warn',
      {
        allow: ['constructors']
      }
    ],
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-plusplus': 'off',
    'no-var': 'error',
    'class-methods-use-this': 'off',
    radix: 'error',
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/']
      }
    ],
    'func-names': ['off'],
    'no-return-assign': ['off'],
    'consistent-return': ['off'],
    'no-restricted-syntax': ['warn'],
    'no-param-reassign': ['off'],
    'prefer-destructuring': ['warn'],
    'no-prototype-builtins': ['off'],
    'no-use-before-define': ['off'],
    'default-case': ['warn'],
    'no-else-return': ['off'],
    'no-continue': ['off'],
    'jest/no-standalone-expect': ['off'],
    'no-undef': ['off'],
    'no-nested-ternary': ['warn'],
    'no-multi-assign': ['warn'],
    'max-classes-per-file': ['off'],
    'no-await-in-loop': ['warn'],
    'no-case-declarations': ['warn'],
    'jest/no-export': ['warn'],
    'jest/no-try-expect': ['warn'],
    'jest/no-test-callback': ['warn'],
    'operator-assignment': ['off'],
    'unused-imports/no-unused-imports-ts': ['error'],
    'dot-notation': ['error'],
    'jest/no-focused-tests': ['error']
  }
};

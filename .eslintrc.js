/* global module */
module.exports = {
  parser: '@typescript-eslint/parser',
  plugins: ['import', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:promise/recommended',
    'prettier',
    'prettier/@typescript-eslint'
  ],
  root: true,
  env: {
    node: true,
    jest: true
  },
  rules: {
    // -- Extra rules --
    // Reason: Missing curly braces (for example in if statements) are hard to read and may lead to bugs.
    curly: 'warn',
    // Reason: Logs should be only be done with fastify.
    //         Some logs are allowed for cli scripts.
    'no-console': [
      'error',
      {
        allow: ['info', 'warn', 'error', 'time', 'timeEnd']
      }
    ],
    // Reason: "any" disables the type checker and shouldn't be used.
    '@typescript-eslint/no-explicit-any': 'error',
    // Reason: All dependencies that are used in the App should be defined in package.json#dependencies.
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['**/*.spec.ts'],
        optionalDependencies: false,
        peerDependencies: false
      }
    ],
    // Reason: Automatic sorting of imports to avoid unnecessary merge conflicts.
    'import/order': [
      'warn',
      {
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true
        }
      }
    ],
    // Reason: This leads to bad performance and most of the time Promise.all
    //         should be used instead.
    'no-await-in-loop': 'error',
    // Reason: Improves readability.
    'no-else-return': ['error', { allowElseIf: false }],
    // Reason: Detects unnecessary code.
    'no-extra-bind': 'error',
    // Reason: Improves readability. An exception is the !! pattern with booleans
    //         as it is very common and well known.
    'no-implicit-coercion': ['warn', { boolean: false }],
    // Reason: Improves readability.
    'no-lonely-if': 'warn',
    // Reason: Detects unnecessary code.
    'no-self-compare': 'error',
    // Reason: Detects possible bugs.
    'no-template-curly-in-string': 'error',
    // Reason: Improves readability and performance.
    'no-useless-call': 'error',
    // Reason: Improves readability.
    'no-useless-computed-key': 'warn',
    // Reason: Improves readability.
    'no-useless-concat': 'error',
    // Reason: Detects unnecessary code.
    'no-useless-return': 'error',
    // Reason: Improves readability.
    'object-shorthand': 'warn',
    // Reason: Improves readability.
    'prefer-const': ['warn', { ignoreReadBeforeAssign: true }],
    // Reason: Improves readability.
    'prefer-destructuring': 'warn',
    // Reason: Improves readability and performance.
    'prefer-numeric-literals': 'error',
    // Reason: Improves readability.
    'prefer-regex-literals': 'error',
    // Reason: Improves readability.
    'prefer-template': 'error',
    // Reason: Thrown literal don't have stack traces.
    'no-throw-literal': 'error',
    // Reason: Detects unnecessary code.
    'no-return-await': 'error',
    // Reason: Unused imports increase the application size and decrease the performance
    'unused-imports/no-unused-imports-ts': 'warn',
    // Reason: Unused variables increase the application size and are confusing
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }
    ],
    // Reason: Detects unnecessary code.
    '@typescript-eslint/no-useless-constructor': 'error',
    // Reason: Improves readability.
    '@typescript-eslint/prefer-as-const': 'error',

    // -- Disabled rules --
    // Reason: We have cli scripts that need to exit the app
    'no-process-exit': 'off',
    // Reason: Not necessary if the type can be inferred. Produces a lot of boilerplate.
    '@typescript-eslint/explicit-module-boundary-types': 'off'
  }
};

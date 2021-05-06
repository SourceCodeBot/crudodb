module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'airbnb-base',
    'prettier',
    'prettier/@typescript-eslint',
    'plugin:jest/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
    project: './src/tsconfig.app.json',
    createDefaultProgram: true
  },
  plugins: ['@typescript-eslint', 'unused-imports', 'jest'],
  rules: {}
};

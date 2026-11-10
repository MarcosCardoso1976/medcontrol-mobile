// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*'],
  },
  {
    rules: {
      // O TypeScript já valida os exports (ex.: Notifications.AndroidImportance); a regra gera falso positivo com `export *`.
      'import/namespace': 'off',
    },
  },
  {
    // Nos testes, `jest.mock()` precisa vir antes dos imports.
    files: ['__tests__/**'],
    rules: { 'import/first': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
]);

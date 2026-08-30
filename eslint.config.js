// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // Generiertes und Gebautes gehört nicht in den Lint
    ignores: ['dist/*', 'android/*', 'ios/*', 'expo-env.d.ts', '.expo/*'],
  },
]);

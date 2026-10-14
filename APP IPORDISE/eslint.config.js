// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      ".expo/**",
      ".eas-build-inspect/**",
      ".preview-export/**",
      ".vercel/**",
      "design-qa/**",
      "dist*/**",
      "functions/**",
      "IPORDISE/**",
      "out*/**",
      "release-artifacts/**",
      "scripts/**",
      "supabase/functions/**",
      "tmp/**",
      "website-ipordise/**",
    ],
  }
]);

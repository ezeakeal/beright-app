const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to copy Google Play Billing native module
 * Dependency is added via expo-build-properties in app.config.ts
 */
const withGooglePlayBillingModule = (config) => {
  // Copy native module to Android project
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot;
      
      const sourceFile = path.join(projectRoot, 'native-modules', 'GooglePlayBillingModule.kt');
      const targetDir = path.join(
        platformRoot,
        'app',
        'src',
        'main',
        'java',
        'com',
        'vadix',
        'berightapp'
      );
      const targetFile = path.join(targetDir, 'GooglePlayBillingModule.kt');

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy the native module file
      if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log('✅ Copied GooglePlayBillingModule.kt to Android project');
      } else {
        console.warn('⚠️  Warning: GooglePlayBillingModule.kt not found in native-modules/');
      }

      return config;
    },
  ]);

  return config;
};

module.exports = withGooglePlayBillingModule;


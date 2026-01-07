const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to add Google Play Billing support
 */
const withGooglePlayBillingDependency = (config) => {
  // Add dependency to build.gradle
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    
    if (!contents.includes('com.android.billingclient:billing')) {
      config.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation("com.android.billingclient:billing:6.1.0")`
      );
    }
    
    return config;
  });

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

module.exports = withGooglePlayBillingDependency;


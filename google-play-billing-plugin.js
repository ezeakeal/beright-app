const { withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to add Google Play Billing support
 * Adds the billing library dependency and copies the native module
 */
const withGooglePlayBillingModule = (config) => {
  // Add dependency to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    const { contents } = config.modResults;
    const billingDep = 'implementation("com.android.billingclient:billing:6.2.1")';
    
    // Only add if not already present
    if (!contents.includes('com.android.billingclient:billing')) {
      // Find the dependencies block and add after the opening brace
      const dependenciesRegex = /(dependencies\s*\{)/;
      if (dependenciesRegex.test(contents)) {
        config.modResults.contents = contents.replace(
          dependenciesRegex,
          `$1\n    ${billingDep}`
        );
        console.log('✅ Added billing library dependency to build.gradle');
      } else {
        console.warn('⚠️  Warning: Could not find dependencies block in build.gradle');
      }
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

module.exports = withGooglePlayBillingModule;


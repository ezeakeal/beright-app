const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Add Google Play Billing dependency to android/app/build.gradle
 * This runs AFTER prebuild, so it modifies the generated file
 */
const withGooglePlayBilling = (config) => {
  return withAppBuildGradle(config, (config) => {
    const { contents } = config.modResults;
    
    // Check if already added
    if (contents.includes('com.android.billingclient:billing')) {
      return config;
    }
    
    // Add before the closing brace of dependencies
    const billingDep = '    implementation "com.android.billingclient:billing:6.2.1"';
    
    // Find the last dependency and add after it
    config.modResults.contents = contents.replace(
      /(\s+implementation jscFlavor\s*\n)/,
      `$1\n    // Google Play Billing Library for Alternative Billing\n${billingDep}\n`
    );
    
    return config;
  });
};

module.exports = withGooglePlayBilling;

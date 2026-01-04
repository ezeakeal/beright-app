const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Minimal config plugin to add Google Play Billing Library dependency
 */
const withGooglePlayBillingDependency = (config) => {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    
    // Check if dependency already exists
    if (!contents.includes('com.android.billingclient:billing')) {
      // Add the dependency in the dependencies block
      config.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation("com.android.billingclient:billing:6.1.0")`
      );
    }
    
    return config;
  });
};

module.exports = withGooglePlayBillingDependency;


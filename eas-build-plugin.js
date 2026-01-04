const { withAppBuildGradle, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config plugin to add Google Play Billing support for Alternative Billing
 */
const withGooglePlayBilling = (config) => {
  // Add Google Play Billing Library dependency to build.gradle
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    
    // Check if dependency already exists
    if (!contents.includes('com.android.billingclient:billing')) {
      // Add after the react-android dependency
      config.modResults.contents = contents.replace(
        /implementation\("com\.facebook\.react:react-android"\)/,
        `implementation("com.facebook.react:react-android")
    
    // Google Play Billing Library for Alternative Billing
    implementation("com.android.billingclient:billing:6.1.0")`
      );
    }
    
    return config;
  });

  // Copy custom native modules and update MainApplication
  config = withMainApplication(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const androidMainDir = path.join(
      config.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'java',
      'com',
      'vadix',
      'berightapp'
    );

    // Ensure directory exists
    if (!fs.existsSync(androidMainDir)) {
      fs.mkdirSync(androidMainDir, { recursive: true });
    }

    // Copy native modules
    const nativeModulesDir = path.join(projectRoot, 'native-modules');
    const filesToCopy = [
      'GooglePlayBillingModule.kt',
      'GooglePlayBillingPackage.kt'
    ];

    filesToCopy.forEach((file) => {
      const src = path.join(nativeModulesDir, file);
      const dest = path.join(androidMainDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied ${file}`);
      } else {
        console.warn(`⚠️  Warning: ${file} not found in native-modules/`);
      }
    });

    // Update MainApplication.kt to register the package
    let mainAppContents = config.modResults.contents;
    
    // Check if already registered
    if (!mainAppContents.includes('GooglePlayBillingPackage')) {
      // Add the package to the packages list
      mainAppContents = mainAppContents.replace(
        /(override fun getPackages\(\): List<ReactPackage> =\s+PackageList\(this\)\.packages\.apply\s*{[^}]*)/,
        `$1
              add(GooglePlayBillingPackage())`
      );
      
      config.modResults.contents = mainAppContents;
      console.log('✅ Registered GooglePlayBillingPackage in MainApplication.kt');
    }

    return config;
  });

  return config;
};

module.exports = withGooglePlayBilling;


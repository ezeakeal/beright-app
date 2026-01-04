# Google Play Alternative Billing Integration with Expo/EAS

## Overview
This project integrates Google Play's Alternative Billing (EEA only) with Stripe payments using a custom native Android module.

## Key Resources

### Official Documentation
- **Expo Config Plugins**: https://docs.expo.dev/guides/config-plugins/
- **EAS Build Hooks**: https://docs.expo.dev/build-reference/how-tos/#eas-build-hooks
- **Expo Prebuild**: https://docs.expo.dev/workflow/prebuild/
- **Google Play Alternative Billing**: https://developer.android.com/google/play/billing/external/integration
- **Google Play Billing Library**: https://developer.android.com/google/play/billing (requires v6.0+)

### Alternative Approaches

1. **Config Plugins (Recommended for Expo)**
   - Create a custom config plugin to modify `build.gradle` and add native files
   - More maintainable than build hooks
   - Example: https://docs.expo.dev/config-plugins/plugins-and-mods/

2. **EAS Build Hooks (Current Approach)**
   - Run scripts during the build process
   - We use `postInstall` hook to copy native modules
   - Simpler but less integrated with Expo's prebuild

3. **expo-in-app-purchases**
   - Expo's official IAP library
   - Does NOT support Alternative Billing token generation yet
   - Good for standard Google Play IAP, not for alternative billing

## Our Implementation

### Why Custom Native Module?
- `expo-in-app-purchases` doesn't support `createBillingProgramReportingDetailsAsync()`
- `react-native-iap` also lacks this specific API
- Google Play Billing Library v6.1.0+ required for Alternative Billing
- Token must be generated BEFORE payment (not after)

### Architecture
```
User clicks "Top up"
  ↓
Native Module: getAlternativeBillingToken()
  ↓
Google Play Billing: createBillingProgramReportingDetailsAsync()
  ↓
Token returned to React Native
  ↓
Stripe Payment Sheet shown
  ↓
Payment succeeds
  ↓
Token sent to server with confirmPaymentIntent
  ↓
Server reports to Google Play API with token
```

### Files
- `native-modules/GooglePlayBillingModule.kt` - Native Android module
- `native-modules/GooglePlayBillingPackage.kt` - React Native package
- `native-modules/MainApplication.kt` - App entry point with module registration
- `eas-build-post-install.sh` - EAS hook to copy files & add dependency
- `utils/googlePlayBilling.ts` - TypeScript interface to native module

### Key Points
1. **Token Timing**: Must be obtained BEFORE redirecting to payment processor
2. **Token Uniqueness**: Each transaction requires a new token
3. **No Caching**: Tokens cannot be reused across purchases
4. **EEA Only**: Alternative Billing is only available in EEA countries
5. **Reporting Required**: Must report within 3 days using `externaltransactions` API

## Future Improvements

### Option 1: Create a Config Plugin
Instead of build hooks, create `app.plugin.js`:

```javascript
const { withAppBuildGradle, withMainApplication } = require('@expo/config-plugins');

module.exports = function withGooglePlayBilling(config) {
  // Add dependency to build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('com.android.billingclient:billing')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*{/,
        `dependencies {\n    implementation("com.android.billingclient:billing:6.1.0")`
      );
    }
    return config;
  });

  // Add module registration
  config = withMainApplication(config, (config) => {
    // Modify MainApplication.kt to register GooglePlayBillingPackage
    return config;
  });

  return config;
};
```

Then in `app.config.js`:
```javascript
export default {
  // ...
  plugins: [
    './app.plugin.js'
  ]
};
```

### Option 2: Use Development Builds
- Run `expo prebuild` locally
- Commit Android folder to git
- More control but larger repository

## Common Issues

### Build Fails with Missing gradlew
- Don't partially commit Android folder
- Either commit all or use hooks/plugins

### Module Not Found
- Check `MainApplication.kt` registers the package
- Verify billing library dependency in `build.gradle`

### Token Generation Fails
- Ensure app is published to at least internal testing track
- Service account must have permissions in Play Console
- Check device is in EEA region

### Invalid Token Error
- Verify token is generated BEFORE payment (not after)
- Check token is being passed to server correctly
- Ensure token is fresh (not cached)

## Monitoring API Changes

### Google Play Billing
- Subscribe to: https://developer.android.com/google/play/billing/release-notes
- Required: Billing Library v6.0+ (as of 2024)
- Breaking changes announced 6+ months in advance

### Expo Updates
- Check: https://blog.expo.dev/
- SDK releases: ~every 3 months
- Breaking changes in major versions only

### Best Practices
1. Pin exact dependency versions in `build.gradle`
2. Test thoroughly before updating billing library
3. Keep logs of token generation for debugging
4. Monitor Google Play Console for policy updates
5. Set up alerts for failed transaction reports

## Testing

### Local Testing
```bash
# Prebuild to test hooks
expo prebuild --clean

# Check generated files
cat android/app/build.gradle | grep billing
ls -la android/app/src/main/java/com/vadix/berightapp/
```

### EAS Build Testing
```bash
# Build for testing
eas build --platform android --profile preview

# Check build logs for hook execution
# Look for: "🔧 Copying custom Android files..."
```

### Production Checklist
- [ ] Test token generation on real device
- [ ] Verify token appears in Firestore payment records
- [ ] Confirm Google Play API reports succeed
- [ ] Monitor retry job for failed reports
- [ ] Check service account permissions in Play Console
- [ ] Verify app published to at least internal testing

---
Last Updated: 2026-01-03
Next Review: 2026-04-03 (or when Google Play Billing v7 releases)


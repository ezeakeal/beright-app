# Google Play External Transaction Token - Research & Best Practices

**Date:** 2026-01-08  
**Status:** Active Implementation

## Summary

Based on extensive research of Google's official documentation and community reports, here are the key findings for implementing the `external_transaction_token` for Alternative Billing in the EEA.

---

## Critical Requirements

### 1. Correct BillingProgram Constant

**For Alternative Billing (EEA):**
```kotlin
BillingProgram.EXTERNAL_OFFER  // ✅ Correct for Alternative Billing
```

**NOT:**
```kotlin
BillingProgram.EXTERNAL_PAYMENTS  // ❌ Wrong - This is for a different program
```

**Source:** [Google Play Billing - External Integration](https://developer.android.com/google/play/billing/external/integration)

### 2. Token Generation Timing

**MUST generate token:**
- ✅ Immediately before directing user to external payment
- ✅ Fresh for each transaction
- ✅ Within the same user session

**MUST NOT:**
- ❌ Cache tokens across transactions
- ❌ Generate token after payment
- ❌ Reuse tokens from previous purchases

**Our Implementation:**
```typescript
// App.tsx
const googlePlayToken = await getAlternativeBillingToken(); // Generate FIRST
await initStripePayment(googlePlayToken);                    // Then pay
```

### 3. User Eligibility Check (Optional but Recommended)

Before generating token, check if user is eligible:

```kotlin
billingClient.isBillingProgramAvailableAsync(
    BillingProgram.EXTERNAL_OFFER,
    object : BillingProgramAvailabilityListener {
        override fun onBillingProgramAvailabilityResponse(
            billingProgram: Int, 
            billingResult: BillingResult
        ) {
            if (billingResult.responseCode == BillingResponseCode.OK) {
                // User is eligible for alternative billing
                generateToken()
            } else {
                // Fall back to standard Google Play billing
            }
        }
    }
)
```

### 4. App Requirements

**Must be completed:**
- ✅ App published to at least **internal testing track**
- ✅ Google Play Developer API enabled in GCP
- ✅ Service account linked in **Play Console → Setup → API access** (NOT just "Users and permissions")
- ✅ Alternative Billing program enrollment accepted in Play Console
- ✅ Service account has "Release Manager" or "Admin" role

**Permissions:**
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="com.android.vending.BILLING" />
```

### 5. Reporting Requirements

**Backend must report transaction within 3 days:**

```javascript
// POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/externaltransactions
{
  externalTransactionId: "pi_...",  // Your unique ID (e.g., Stripe PaymentIntent ID)
  packageName: "com.vadix.berightapp",
  currentPreTaxAmount: {
    priceMicros: "1000000",  // €1.00 = 1,000,000 micros
    currency: "EUR"
  },
  currentTaxAmount: {
    priceMicros: "0",
    currency: "EUR"
  },
  transactionState: 1,  // COMPLETED
  transactionTime: "2026-01-08T12:00:00Z",
  oneTimeTransaction: {
    externalTransactionToken: "eyJhbGci..."  // Token from BillingClient
  },
  userTaxAddress: {
    regionCode: "IE"  // ISO 3166-1 alpha-2
  }
}
```

---

## Common Issues & Solutions

### Issue 1: "external_transaction_token is invalid"

**Possible Causes:**
1. **Token generated AFTER payment** → Generate BEFORE
2. **Cached/reused token** → Generate fresh for each transaction
3. **Wrong BillingProgram** → Use `EXTERNAL_OFFER` not `EXTERNAL_PAYMENTS`
4. **App not published** → Publish to internal testing track minimum
5. **Service account not linked** → Link in Play Console → Setup → API access
6. **Token expired** → Tokens have short lifetime, don't delay payment

**Debug Steps:**
```bash
# 1. Check if token is being generated
adb logcat | grep "BillingClient"

# 2. Check token format (should be JWT-like)
# Token format: "eyJhbGci..." (base64 encoded)

# 3. Verify timing
console.log("Token generated:", googlePlayToken);
console.log("Stripe initiated:", new Date());
```

### Issue 2: "The current user has insufficient permissions"

**Fix:**
1. Go to [Play Console](https://play.google.com/console)
2. Navigate to: **Setup → API access**
3. Find your service account: `PROJECT_NUMBER-compute@developer.gserviceaccount.com`
4. Click "Grant access" if not listed
5. Select "Release Manager" or "Admin" role
6. Save

**Note:** This is DIFFERENT from "Users and permissions" section.

### Issue 3: Billing Library Classes Not Found (Compilation Error)

**Symptoms:**
```
Unresolved reference 'BillingProgramReportingDetailsParams'
Unresolved reference 'BillingProgram'
```

**Root Cause:**
The billing library dependency must be added to `app/build.gradle` during the Expo prebuild process. There are multiple approaches, with varying success:

**Approach 1: expo-build-properties.extraDependencies** ❌ Didn't work reliably
```typescript
// app.config.ts
{
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          extraDependencies: [
            'com.android.billingclient:billing:7.1.1'
          ]
        }
      }
    ]
  ]
}
```
*Issue: During EAS builds, this didn't consistently add the dependency.*

**Approach 2: withAppBuildGradle (Config Plugin)** ✅ Correct solution
```javascript
// google-play-billing-plugin.js
const { withAppBuildGradle } = require('@expo/config-plugins');

const withGooglePlayBillingModule = (config) => {
  config = withAppBuildGradle(config, (config) => {
    const { contents } = config.modResults;
    const billingDep = 'implementation("com.android.billingclient:billing:6.2.1")';
    
    if (!contents.includes('com.android.billingclient:billing')) {
      config.modResults.contents = contents.replace(
        /(dependencies\s*\{)/,
        `$1\n    ${billingDep}`
      );
    }
    
    return config;
  });
  
  return config;
};

module.exports = withGooglePlayBillingModule;
```

Then in `app.config.ts`:
```typescript
{
  plugins: [
    './google-play-billing-plugin.js'
  ]
}
```

**Verification:**
```bash
# After local prebuild
expo prebuild --clean
cat android/app/build.gradle | grep billing
# Should output: implementation("com.android.billingclient:billing:7.1.1")
```

### Issue 4: Context Access in Expo Modules

**Correct way to get Android Context:**

```kotlin
// Expo Modules API
val context = appContext.activityProvider?.currentActivity?.applicationContext
  ?: throw Exception("Application context not available")
```

**Don't use:**
```kotlin
// React Native (old way)
val context = reactContext.applicationContext  // ❌ Won't work with Expo Modules
```

---

## Implementation Checklist

### Client-Side (React Native)
- [x] Install `expo-modules-core`
- [x] Create `GooglePlayBillingModule.kt` using Expo Modules API
- [x] Use `BillingProgram.EXTERNAL_OFFER` (not EXTERNAL_PAYMENTS)
- [x] Create `expo-module.config.json` for autolinking
- [x] Add billing dependency via `expo-build-properties`
- [x] Call `getAlternativeBillingToken()` BEFORE Stripe payment
- [x] Pass token to server with payment confirmation

### Server-Side (Cloud Functions)
- [x] Install `googleapis` package
- [x] Store `googlePlayToken` in payment record
- [x] Report to `externaltransactions` API with token
- [x] Use camelCase for all API fields (not snake_case)
- [x] Set up retry mechanism for failed reports
- [x] Use numeric enum `transactionState: 1` (not string)

### Google Cloud / Play Console
- [x] Enable Google Play Developer API
- [x] Publish app to internal testing track
- [x] Enroll in Alternative Billing program
- [x] Link service account in **Setup → API access**
- [x] Grant "Release Manager" role to service account
- [x] Set up Cloud Scheduler for retry job (every 30 min)

### Testing
- [ ] Test token generation on real Android device in EEA
- [ ] Verify token appears in logs before Stripe payment
- [ ] Confirm token stored in Firestore payment record
- [ ] Check Google Play API reports succeed (status 200)
- [ ] Test retry mechanism with forced failure
- [ ] Monitor Firestore for `googlePlayReported: true`

---

## Key Differences: EXTERNAL_OFFER vs EXTERNAL_PAYMENTS

| Feature | EXTERNAL_OFFER (Alternative Billing) | EXTERNAL_PAYMENTS (User Choice Billing) |
|---------|--------------------------------------|----------------------------------------|
| **Availability** | EEA only | All regions (where approved) |
| **Program Type** | Alternative to Google Play billing | Supplement to Google Play billing |
| **User Experience** | Choose alternative payment at checkout | Google Play OR external payment |
| **Commission** | Reduced fee (varies by region) | Standard fee applies |
| **Implementation** | `BillingProgram.EXTERNAL_OFFER` | `BillingProgram.EXTERNAL_PAYMENTS` |
| **Our Use Case** | ✅ This is what we're using | ❌ Not applicable |

**Source:** [Google Play Billing Programs](https://support.google.com/googleplay/android-developer/answer/13821247)

---

## API Reference

### Google Play Developer API - External Transactions
```
POST /androidpublisher/v3/applications/{packageName}/externaltransactions
```

**Required OAuth Scope:**
```
https://www.googleapis.com/auth/androidpublisher
```

**Field Reference (camelCase):**
- `externalTransactionId` - Your unique transaction ID (string)
- `packageName` - Android package name (string)
- `currentPreTaxAmount` - Object with `priceMicros` (string) and `currency` (string)
- `currentTaxAmount` - Object with `priceMicros` (string) and `currency` (string)
- `transactionState` - Numeric enum: 0=UNSPECIFIED, 1=COMPLETED, 2=REFUNDED, 3=CANCELED (number)
- `transactionTime` - ISO 8601 timestamp (string)
- `oneTimeTransaction` - Object with `externalTransactionToken` (string)
- `userTaxAddress` - Object with `regionCode` (ISO 3166-1 alpha-2)

**Important:**
- Use `priceMicros` not `units`/`nanos`
- Use `currency` not `currencyCode`
- All fields are camelCase in the `googleapis` Node.js library
- Price in micros = cents × 10,000 (e.g., €1.00 = 100 cents = 1,000,000 micros)

---

## Monitoring & Maintenance

### Logs to Watch
```bash
# Client-side token generation
adb logcat | grep "GooglePlayBilling"

# Server-side reporting
gcloud logging read "resource.type=cloud_function AND GOOGLE_PLAY" --limit 50

# Firestore query for failed reports
where("googlePlayReported", "==", false)
  .where("googlePlayReportAttempts", ">", 0)
```

### Key Metrics
- **Token generation success rate** - Should be ~100%
- **API report success rate** - Should be >99% (after retries)
- **Average time to report** - Should be <1 minute (or <24 hours with retries)
- **Failed report reasons** - Track in Firestore `lastReportError`

### Alert Thresholds
- 🔴 Critical: >10 failed reports in 1 hour
- 🟡 Warning: >5 failed reports in 24 hours
- 🟢 OK: <5 failed reports per week

---

## Cost Analysis

### Google Play Billing Library
- **Cost:** FREE (included with Play Services)

### Google Play Developer API
- **Cost:** FREE (no quota charges)

### Cloud Scheduler (Retry Job)
- **Frequency:** Every 30 minutes = 48 runs/day
- **Cost:** $0.10/month for 48 jobs
- **Alternative:** Every 12 hours = $0.003/month
- **Recommendation:** 30 min for better UX (negligible cost difference)

### Cloud Functions (Retry Function)
- **Invocations:** 48/day × 30 days = 1,440/month
- **Cost:** FREE (within free tier: 2M invocations/month)

**Total Additional Cost:** ~$0.10/month

---

## Version History

| Date | Version | Change |
|------|---------|--------|
| 2026-01-03 | 1.0.0 | Initial implementation with `react-native-iap` |
| 2026-01-03 | 1.0.1 | Switched to custom native module |
| 2026-01-08 | 1.0.2 | Fixed Expo Modules API integration + context access |

---

## References

1. [Google Play Alternative Billing Integration](https://developer.android.com/google/play/billing/external/integration)
2. [Google Play Billing Library](https://developer.android.com/google/play/billing)
3. [External Transactions API](https://developers.google.com/android-publisher/api-ref/rest/v3/externaltransactions)
4. [Expo Modules API](https://docs.expo.dev/modules/overview/)
5. [Expo Config Plugins](https://docs.expo.dev/config-plugins/plugins-and-mods/)
6. [User Choice Billing](https://support.google.com/googleplay/android-developer/answer/13821247)

---

**Last Updated:** 2026-01-08  
**Next Review:** When Google Play Billing Library v8 releases  
**Owner:** Daniel Vagg


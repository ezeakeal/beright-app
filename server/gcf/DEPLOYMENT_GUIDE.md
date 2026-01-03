# Google Play Alternative Billing - Deployment Guide

## Status: Code Ready ✅

The code is now production-ready with real Google Play API integration. It will work as soon as you complete the Play Console setup.

## What's Been Updated

### ✅ Files Modified:
- `server/gcf/package.json` - Added `googleapis` package
- `server/gcf/index.js` - Replaced placeholder with real API implementation

### ✅ How It Works Now:

1. **Payment succeeds** → Stripe processes payment
2. **Data stored** → Firestore gets payment record with `externalTransactionId`
3. **Immediate reporting attempt** → Calls Google Play API
4. **If successful** → Marks as `googlePlayReported: true`
5. **If fails** → Logs error, stores failure info, retry job will pick it up later

### ✅ Graceful Failure:

The code uses Application Default Credentials and will fail gracefully until you:
- Publish your app to Play Console
- Get API access in Play Console
- Add your service account (`beright-app@appspot.gserviceaccount.com`) with Release Manager role

## Current Behavior (Before API Access)

**What happens when a user makes a payment:**

```
[GOOGLE_PLAY] Reporting transaction: { externalTransactionId: 'pi_xxx', ... }
[GOOGLE_PLAY] Failed to report transaction: {
  error: "The caller does not have permission",
  code: 403
}
```

**Payment still succeeds** ✅ - This error is caught and logged, but doesn't block payment.

**Retry job will process it** ✅ - Transaction stays as `googlePlayReported: false` for retry.

## Deployment Steps

### 1. Install Dependencies

```bash
cd server/gcf
npm install
```

This will install the `googleapis` package.

### 2. Deploy Cloud Function

```bash
# Deploy the main function
gcloud functions deploy generateText \
  --gen2 \
  --runtime=nodejs20 \
  --region=YOUR_REGION \
  --source=. \
  --entry-point=generateText \
  --trigger-http \
  --allow-unauthenticated

# Deploy the stripe webhook
gcloud functions deploy stripeWebhook \
  --gen2 \
  --runtime=nodejs20 \
  --region=YOUR_REGION \
  --source=. \
  --entry-point=stripeWebhook \
  --trigger-http \
  --allow-unauthenticated

# Deploy the retry job (optional for now)
gcloud functions deploy retryGooglePlayReports \
  --gen2 \
  --runtime=nodejs20 \
  --region=YOUR_REGION \
  --source=. \
  --entry-point=retryGooglePlayReports \
  --trigger-http
```

### 3. Test Payment Flow

After deploying, test a payment:

1. Make a test purchase in your app
2. Check Cloud Function logs:
   ```bash
   gcloud functions logs read generateText --gen2 --region=YOUR_REGION --limit=50
   ```
3. Look for `[GOOGLE_PLAY]` entries
4. Expected: 403 permission error (until Play Console setup is complete)
5. Verify payment still succeeds and credits are added

### 4. Verify Firestore

Check that payment records have:
```javascript
{
  externalTransactionId: "pi_xxx...",
  googlePlayReported: false,
  googlePlayReportAttempts: 1,
  lastReportAttemptAt: <timestamp>,
  lastReportError: "The caller does not have permission",
  lastReportErrorCode: 403
}
```

## After Publishing Your App

Once you publish to Play Console and get API access:

### 1. Enable Google Play Developer API

```bash
gcloud services enable androidpublisher.googleapis.com --project=YOUR_PROJECT_ID
```

Or visit: https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com

### 2. Add Service Account to Play Console

1. Go to Play Console → Settings → API access
2. Find your service account: `beright-app@appspot.gserviceaccount.com`
3. Click "Grant access"
4. Select **"Release Manager"** role (minimum required)
5. Save

### 3. Enroll in Alternative Billing

1. Go to Play Console → Settings → Alternative billing
2. Choose **"EEA Alternative Billing Only"** (simplest for Ireland)
3. Accept Terms of Service
4. Complete enrollment

### 4. Re-deploy (Optional)

The code is already updated, but you can redeploy to be sure:

```bash
cd server/gcf
gcloud functions deploy generateText --gen2 --region=YOUR_REGION
```

### 5. Test Again

Make another test purchase and check:

```
[GOOGLE_PLAY] Reporting transaction: { ... }
[GOOGLE_PLAY] API Response: { name: "...", createTime: "...", ... }
[GOOGLE_PLAY] Transaction reported successfully: pi_xxx
```

### 6. Deploy Retry Job (Recommended)

Set up the scheduled retry job:

```bash
# Deploy the function
gcloud functions deploy retryGooglePlayReports \
  --gen2 \
  --runtime=nodejs20 \
  --region=YOUR_REGION \
  --trigger-http

# Create scheduler job (runs every 30 minutes)
gcloud scheduler jobs create http retry-google-play-reports \
  --location=YOUR_REGION \
  --schedule="*/30 * * * *" \
  --uri="https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/retryGooglePlayReports" \
  --http-method=POST
```

## Monitoring

### Check Unreported Transactions

Use Firestore console or query:

```javascript
db.collection('payments')
  .where('googlePlayReported', '==', false)
  .get()
  .then(snapshot => {
    console.log(`${snapshot.size} unreported transactions`);
  });
```

### Check Failed Reporting Attempts

```javascript
db.collection('payments')
  .where('googlePlayReported', '==', false)
  .where('googlePlayReportAttempts', '>', 3)
  .get()
  .then(snapshot => {
    console.log(`${snapshot.size} transactions failing repeatedly`);
  });
```

### View Logs

```bash
# Main function logs
gcloud functions logs read generateText --gen2 --region=YOUR_REGION --limit=50

# Filter for Google Play entries
gcloud functions logs read generateText --gen2 --region=YOUR_REGION --limit=50 | grep GOOGLE_PLAY

# Retry job logs
gcloud functions logs read retryGooglePlayReports --gen2 --region=YOUR_REGION --limit=20
```

## Timeline

- **Now**: Code is ready, payments work via Stripe
- **After app upload**: Can access Play Console settings
- **After API setup**: Reporting works automatically
- **After enrollment**: Fully compliant with Google Play Alternative Billing

## Support

If you see errors after setting up API access:

1. **403 Forbidden**: Service account needs permissions in Play Console
2. **404 Not Found**: API not enabled or wrong package name
3. **400 Bad Request**: Check transaction data format (units/nanos)
4. **401 Unauthorized**: Authentication issue with service account

All errors are logged with `[GOOGLE_PLAY]` prefix for easy searching.

---

**Next Steps**: 
1. Deploy the updated code
2. Finish building your app
3. Upload to Play Console
4. Complete the Play Console setup when API access becomes available


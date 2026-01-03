# Quick Reference - Google Play Alternative Billing

## Deploy Now

```bash
cd server/gcf
npm install
# Deploy your Cloud Functions as usual
```

## Current Behavior

✅ **Payments work** - Stripe processes all payments  
⚠️ **Reporting fails** - Expected until Play Console API access  
✅ **Data tracked** - All transaction data stored properly  
✅ **Non-blocking** - Reporting errors don't affect payments  

## After Publishing Your App

### 1. Enable API (5 minutes)
```bash
gcloud services enable androidpublisher.googleapis.com
```

### 2. Add Service Account to Play Console (5 minutes)
- Go to: Play Console → Settings → API access
- Find: `beright-app@appspot.gserviceaccount.com`
- Grant: "Release Manager" role

### 3. Enroll in Alternative Billing (10 minutes)
- Go to: Play Console → Settings → Alternative billing
- Choose: "EEA Alternative Billing Only"
- Complete enrollment

### 4. Done!
No code changes needed - reporting starts working automatically.

## Logs to Check

```bash
# View Google Play reporting logs
gcloud functions logs read generateText --gen2 | grep GOOGLE_PLAY
```

**Before API access:**
```
[GOOGLE_PLAY] Failed to report transaction: { code: 403 }
```

**After API access:**
```
[GOOGLE_PLAY] Transaction reported successfully: pi_xxx
```

## Files Changed

- `server/gcf/package.json` - Added googleapis
- `server/gcf/index.js` - Real API implementation

## Documentation

- `GOOGLE_PLAY_COMPLETE.md` - Full implementation overview
- `server/gcf/DEPLOYMENT_GUIDE.md` - Detailed deployment steps

---

**Status:** Ready to deploy ✅


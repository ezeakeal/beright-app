# Google Cloud TTS Deployment Guide

## Overview
This implementation adds premium audio narration for paid conversations using Google Cloud Text-to-Speech (Neural2 voices), while keeping the built-in `expo-speech` for free conversations.

## Changes Made

### 1. Server-side (Cloud Function)
- **Added dependency**: `@google-cloud/text-to-speech` in `server/gcf/package.json`
- **Modified `consumeOneRequestCredit()`**: Now returns `{ mode, isPaid }` to track payment type
- **Modified `startConversation` action**: Stores `isPaid` flag in session
- **Added `tts` action**: Generates high-quality MP3 audio using Google Neural2 voices (only for paid conversations)

### 2. Client-side (React Native)
- **Added `expo-av` import**: For playing MP3 audio from Cloud TTS
- **Modified `analyzeConflictStaged()`**: Returns `{ result, sessionToken, isPaid }`
- **Added `generateTTS()` function**: Calls the TTS endpoint with session token
- **Added `speakText()` helper**: Automatically chooses between Google TTS (paid) or built-in TTS (free)
- **Updated UI**: Shows "Play (Premium)" badge for paid conversations

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd server/gcf
npm install
```

This will install `@google-cloud/text-to-speech@^5.5.0`.

### Step 2: Enable Google Cloud TTS API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (same project as your Cloud Functions)
3. Navigate to **APIs & Services > Library**
4. Search for "Cloud Text-to-Speech API"
5. Click **Enable**

### Step 3: Configure Service Account Permissions

Your Cloud Function's service account needs TTS API access:

```bash
# Get your Cloud Function's service account
gcloud functions describe generateText \
  --region=europe-west1 \
  --format="value(serviceAccountEmail)"

# Grant TTS permissions (replace SERVICE_ACCOUNT_EMAIL)
gcloud projects add-iam-policy-binding beright-app-1021561698058 \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudtexttospeech.user"
```

### Step 4: Deploy Cloud Function

```bash
cd server/gcf
gcloud functions deploy generateText \
  --gen2 \
  --runtime=nodejs20 \
  --region=europe-west1 \
  --source=. \
  --entry-point=generateText \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars FIRESTORE_DB=beright-db,GEMINI_API_KEY=YOUR_KEY,STRIPE_SECRET_KEY=YOUR_KEY,STRIPE_PUBLISHABLE_KEY=YOUR_KEY
```

Or use your existing Cloud Build pipeline.

### Step 5: Update React Native App

The client-side changes are already in place. Just rebuild:

```bash
# For development
npx expo start

# For production build
eas build --platform ios
eas build --platform android
```

## Cost Analysis

### Google Cloud TTS Pricing (Neural2 voices)
- **$16 per 1 million characters**
- Average narration: ~200-500 characters
- **Cost per conversation: $0.003 - $0.008**

### Your Pricing
- **Revenue per paid credit: €0.20**
- **TTS cost per credit: ~€0.005**
- **Profit margin: 97.5%** (TTS adds minimal cost)

### Free Tier
- Google Cloud gives **1 million characters/month free**
- That's ~2,000-5,000 conversations/month free
- Your app uses paid credits, so you'll likely stay within free tier for a while

## Testing

### Test with Free Credit
1. Clear app data or use new device
2. Start a conversation (uses free daily credit)
3. Listen to narration - should use built-in TTS
4. Button shows: "🔊 Play"

### Test with Paid Credit
1. Top up credits via Stripe
2. Start a conversation (uses paid credit)
3. Listen to narration - should use Google Neural2 TTS (noticeably better quality)
4. Button shows: "🔊 Play (Premium)"

## Voice Configuration

Current settings (in `server/gcf/index.js`):
```javascript
voice: {
  languageCode: 'en-US',
  name: 'en-US-Neural2-J', // Neutral, natural voice
  ssmlGender: 'NEUTRAL',
},
audioConfig: {
  audioEncoding: 'MP3',
  speakingRate: 0.90,  // Slightly slower than default
  pitch: 0.0,          // Natural pitch
}
```

### Available Voices
To try different voices, change `name` to:
- `en-US-Neural2-A` - Male
- `en-US-Neural2-C` - Female
- `en-US-Neural2-D` - Male
- `en-US-Neural2-F` - Female
- `en-US-Neural2-J` - Neutral (current)

See [full voice list](https://cloud.google.com/text-to-speech/docs/voices).

## Troubleshooting

### Debugging TTS Flow

The implementation now has comprehensive logging. Look for these log patterns:

**Client-side logs (React Native):**
```
[TTS App] 🔊 speakText called: { isPaid: true, hasToken: true, willUseGoogleTTS: true }
[TTS App] 💳 Paid conversation - attempting Google Cloud TTS...
[TTS Client] 🎙️ Requesting TTS generation: { textLength: 234, hasSessionToken: true }
[TTS Client] ✅ Response received: { duration: 1234ms, isPaid: true, hasAudio: true, audioSize: 45.67KB }
[TTS App] 🎵 Playing Google TTS audio...
[TTS App] ✅ Google TTS audio loaded and playing: { loadDuration: 234ms, totalDuration: 1468ms }
```

**Server-side logs (Cloud Function):**
```
[TTS] Request received: { textLength: 234, sessionIsPaid: true, requestIsPaid: true }
[TTS] 🎙️ Paid conversation - generating Google Cloud TTS audio...
[TTS] Calling Google Cloud TTS API...
[TTS] ✅ Google TTS generated successfully: { duration: 1123ms, audioSizeKB: 45.67 }
```

### Common Issues

### TTS not working (falls back to built-in)

**Check logs for:**
```bash
# Client logs should show:
[TTS App] ⚠️ Google TTS returned no audio, falling back to built-in
# OR
[TTS App] ❌ Google TTS failed, falling back to built-in
```

**Server logs:**
```bash
gcloud functions logs read generateText --region=europe-west1 --limit=50

# Look for:
[TTS] ❌ Error generating audio: { errorMessage: "...", errorCode: "..." }
```

**Common causes:**
1. TTS API not enabled
2. Service account lacks permissions
3. Network timeout (>15s)

### Timeout Issues

If you see:
```
[TTS Client] ⏱️ Request timeout (15s) - aborting...
[TTS Client] ⏱️ Request aborted due to timeout
```

**Solutions:**
1. Check if TTS API is slow (first call after cold start can take 5-10s)
2. Increase timeout in `utils/gemini.ts` (line with `setTimeout(..., 15000)`)
3. Check Cloud Function memory allocation (min 512MB recommended)

### Using built-in voice for paid conversations

**Debug steps:**
1. Check `sessionIsPaid` flag in server logs
2. Verify `isPaid` returned from `startConversation` action
3. Check Firestore `conversationSessions` collection for `isPaid: true`

```bash
# Example query
firebase firestore:get conversationSessions/YOUR_SESSION_TOKEN
```

### "Permission denied" errors
```bash
# Re-apply IAM permissions
gcloud projects add-iam-policy-binding beright-app-1021561698058 \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/cloudtexttospeech.user"
```

### Audio not playing on device
- Make sure `expo-av` is installed: `npx expo install expo-av`
- Check app logs for "TTS error:"
- Verify network connectivity
- Check for timeout logs (>15s indicates slow TTS API)

### Verifying TTS is Working

**Good flow (paid conversation with Google TTS):**
```
1. [App] ✅ Analysis complete: { isPaid: true, hasSessionToken: true }
2. [TTS App] 🔊 speakText called: { isPaid: true, willUseGoogleTTS: true }
3. [TTS Client] 🎙️ Requesting TTS generation
4. [TTS] 🎙️ Paid conversation - generating Google Cloud TTS audio...
5. [TTS] ✅ Google TTS generated successfully: { duration: ~1000-3000ms }
6. [TTS App] ✅ Google TTS audio loaded and playing
```

**Expected flow (free conversation with built-in TTS):**
```
1. [App] ✅ Analysis complete: { isPaid: false }
2. [TTS App] 🔊 speakText called: { isPaid: false, willUseGoogleTTS: false }
3. [TTS App] 🆓 Free conversation - using built-in TTS
4. [TTS App] 📱 Using built-in expo-speech TTS
```

**Bad flow (paid but falling back):**
```
1. [App] ✅ Analysis complete: { isPaid: true }
2. [TTS App] 🔊 speakText called: { isPaid: true, willUseGoogleTTS: true }
3. [TTS Client] ❌ Request failed: { error: "..." }
4. [TTS App] ❌ Google TTS failed, falling back to built-in
5. [TTS App] 📱 Using built-in expo-speech TTS
```

In the bad flow case, check server logs for the root cause.

## Rollback Plan

If you need to revert:
1. The built-in TTS still works as fallback
2. Remove TTS action from Cloud Function
3. Or simply disable by returning `{ isPaid: false, audioBase64: null }` from TTS endpoint

## Next Steps

1. ✅ Deploy and test with both free and paid credits
2. Consider adding voice selection as a premium feature
3. Monitor TTS API usage in Google Cloud Console
4. Gather user feedback on voice quality

---

**Estimated setup time**: 15-20 minutes  
**Cost impact**: ~0.5 cents per paid conversation  
**Quality improvement**: Significant - Neural2 voices are very natural


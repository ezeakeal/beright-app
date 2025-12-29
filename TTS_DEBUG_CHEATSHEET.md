# TTS Debugging Cheatsheet

## Quick Diagnostics

### ✅ Is Google TTS Working?

**Check client logs for this sequence:**
```
[TTS App] 💳 Paid conversation - attempting Google Cloud TTS...
[TTS Client] ✅ Response received: { duration: XXXXms, isPaid: true, hasAudio: true }
[TTS App] 🎵 Playing Google TTS audio...
[TTS App] ✅ Google TTS audio loaded and playing
```

### ❌ Common Failure Patterns

#### Pattern 1: Timeout
```
[TTS Client] ⏱️ Request timeout (15s) - aborting...
[TTS App] ❌ Google TTS failed, falling back to built-in
```
**Fix:** 
- First TTS call after cold start is slow (5-10s is normal)
- Increase timeout in `utils/gemini.ts` line ~35: `setTimeout(..., 20000)` (20s)
- Check Cloud Function memory allocation

#### Pattern 2: Permission Denied
```
[TTS] ❌ Error generating audio: { errorMessage: "permission denied" }
```
**Fix:**
```bash
gcloud projects add-iam-policy-binding beright-app-1021561698058 \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@..." \
  --role="roles/cloudtexttospeech.user"
```

#### Pattern 3: API Not Enabled
```
[TTS] ❌ Error generating audio: { errorMessage: "API not enabled" }
```
**Fix:** Enable at https://console.cloud.google.com/apis/library/texttospeech.googleapis.com

#### Pattern 4: Free Conversation Using Built-in (Expected)
```
[TTS App] 🆓 Free conversation - using built-in TTS
[TTS App] 📱 Using built-in expo-speech TTS
```
**This is correct behavior!** Free conversations should use built-in TTS.

#### Pattern 5: Paid but No Session Token
```
[TTS App] 🔊 speakText called: { isPaid: true, hasToken: false, willUseGoogleTTS: false }
```
**Fix:** Session token not being passed. Check `sessionToken` state management in App.tsx.

## Log Locations

### Client Logs (React Native)
```bash
# Expo dev tools
npx expo start
# Then press 'j' to open dev tools and check console

# Or direct Metro logs
npx expo start --no-dev --minify
```

Look for: `[TTS App]` and `[TTS Client]` prefixes

### Server Logs (Cloud Function)
```bash
# Real-time logs
gcloud functions logs read generateText \
  --region=europe-west1 \
  --limit=50 \
  --format="table(time_utc, log)"

# Tail logs
gcloud functions logs read generateText \
  --region=europe-west1 \
  --limit=10 \
  --tail
```

Look for: `[TTS]` prefix

## Testing Commands

### Test with Free Credit
```bash
# Clear app data, then:
1. Start conversation (uses free credit)
2. Check logs: should see "🆓 Free conversation"
3. Listen: should use device voice
```

### Test with Paid Credit
```bash
# Top up credits, then:
1. Start conversation (uses paid credit)
2. Check logs: should see "💳 Paid conversation"
3. Listen: should use Google Neural2 voice (noticeably better)
```

### Force Test TTS API (bypass app)
```bash
# Direct Cloud Function call
curl -X POST https://beright-app-1021561698058.europe-west1.run.app \
  -H "Content-Type: application/json" \
  -H "X-Device-Id: test-device-123" \
  -d '{
    "action": "tts",
    "payload": {
      "text": "This is a test of the Google Cloud Text to Speech system."
    }
  }'
```

Expected response (if working):
```json
{
  "isPaid": true,
  "audioBase64": "//NExAAAAAANIAAAAAExBTUUzLjEwMFVVVVVVVVVVVVVVVVVV..."
}
```

## Monitoring Google TTS Usage

### Check API Calls
```bash
# Google Cloud Console
https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/metrics

# Or CLI
gcloud monitoring timeseries list \
  --filter='metric.type="serviceruntime.googleapis.com/api/request_count" resource.labels.service="texttospeech.googleapis.com"' \
  --format="table(metric.labels.response_code_class, points[0].value)"
```

### Check Costs
```bash
https://console.cloud.google.com/billing/

# Look for "Cloud Text-to-Speech API" charges
# Expected: ~$0.003-0.008 per conversation
```

## Performance Benchmarks

### Expected Timings

**Google TTS (paid):**
- Cold start: 5-10 seconds
- Warm: 1-3 seconds
- Audio loading: 200-500ms
- **Total**: 1.5-10 seconds

**Built-in TTS (free):**
- Instant: <100ms
- **Total**: <100ms

### If Google TTS Takes >15s
1. Check Cloud Function memory (should be 512MB+)
2. Check network latency to Cloud Function
3. Increase timeout value
4. Consider caching audio files

## Quick Fixes

### Reset Everything
```bash
# Clear Firestore sessions
firebase firestore:delete conversationSessions --all-collections --recursive

# Clear app data
# iOS: Settings > App > Clear Data
# Android: Settings > Apps > Bright > Clear Data

# Redeploy Cloud Function
cd server/gcf && npm install
gcloud functions deploy generateText --gen2 ...
```

### Verify Setup Checklist
- [ ] TTS API enabled in Google Cloud Console
- [ ] Service account has `roles/cloudtexttospeech.user`
- [ ] `@google-cloud/text-to-speech` installed in Cloud Function
- [ ] Cloud Function redeployed after adding TTS
- [ ] `expo-av` installed in React Native app
- [ ] App rebuilt after adding TTS code

## Emergency Disable

If TTS is causing issues, disable without redeploying:

**Server-side:** In `server/gcf/index.js`, change:
```javascript
// Line ~450 in TTS action
return res.json({ isPaid: false, audioBase64: null });
```

This forces all conversations to use built-in TTS while you debug.

---

**Need more help?** Check full guide: `TTS_DEPLOYMENT_GUIDE.md`


# Google Cloud TTS Implementation Summary

## ✅ Implementation Complete

**Goal**: Add premium audio narration using Google Cloud TTS for paid conversations, while keeping built-in voice for free conversations.

## 📝 Files Modified

### Server-side (Cloud Function)
1. **`server/gcf/package.json`**
   - Added: `"@google-cloud/text-to-speech": "^5.5.0"`

2. **`server/gcf/index.js`**
   - Import: Added `textToSpeech` client
   - Modified `consumeOneRequestCredit()`: Returns `{ mode, isPaid }` flag
   - Modified `startConversation`: Stores `isPaid` in session
   - Added `tts` action endpoint: Generates Neural2 MP3 audio for paid conversations only

### Client-side (React Native)
3. **`utils/gemini.ts`**
   - Added `generateTTS()` function: Calls server TTS endpoint
   - Modified `analyzeConflictStaged()`: Returns `{ result, sessionToken, isPaid }`
   - Added session token passing to all requests

4. **`App.tsx`**
   - Import: Added `expo-av` for MP3 playback
   - Added state: `sessionToken`, `isPaidConversation`, `audioSound`
   - Added `speakText()`: Smart function that chooses TTS based on payment mode
   - Modified `stopAudio()`: Now handles both Speech and Audio types
   - Updated UI: Shows "Play (Premium)" badge for paid conversations

5. **`TTS_DEPLOYMENT_GUIDE.md`** (NEW)
   - Complete deployment instructions
   - Testing procedures
   - Troubleshooting guide

## 🎯 How It Works

### Flow Diagram
```
User starts conversation
    ↓
Server: consumeCredit() → Returns isPaid flag
    ↓
Server: Creates session with isPaid stored
    ↓
Client: Receives sessionToken + isPaid
    ↓
[Stage narrations play during analysis]
    ↓
Client calls speakText(text, isPaid, token)
    ↓
    ├─ IF isPaid == true:
    │    → Calls generateTTS() endpoint
    │    → Server uses Google Neural2 TTS
    │    → Returns MP3 base64
    │    → Client plays via expo-av
    │
    └─ IF isPaid == false:
         → Uses expo-speech (built-in)
```

## 🎙️ Voice Quality Comparison

| Feature | Free (expo-speech) | Paid (Google Neural2) |
|---------|-------------------|----------------------|
| Quality | ⭐⭐ Robotic | ⭐⭐⭐⭐ Natural |
| Voices | System default | 40+ Neural voices |
| Emotion | Flat | Natural intonation |
| Languages | Basic | 40+ languages |
| Cost | Free | ~€0.005/conversation |

## 💰 Pricing Impact

- **Revenue per paid credit**: €0.20
- **TTS cost per credit**: ~€0.005
- **Net margin**: **97.5%**
- **Google free tier**: 1M chars/month (~2000 conversations)

## 🚀 Deployment Checklist

- [x] Code implemented
- [ ] Install dependencies: `cd server/gcf && npm install`
- [ ] Enable Cloud TTS API in Google Cloud Console
- [ ] Grant TTS permissions to Cloud Function service account
- [ ] Deploy Cloud Function
- [ ] Rebuild React Native app
- [ ] Test with free credit (should use built-in)
- [ ] Test with paid credit (should use Google TTS)

## 🧪 Testing Instructions

### Quick Test
```bash
# Terminal 1: Start dev server
npx expo start

# Test in app:
# 1. Use free conversation → Listen → Basic voice
# 2. Top up credits → Use paid conversation → Listen → Premium voice
# 3. Check button text: "🔊 Play (Premium)" for paid
```

### Verify Google TTS is Working
```bash
# Check Cloud Function logs
gcloud functions logs read generateText \
  --region=europe-west1 \
  --limit=50

# Look for successful TTS calls (no [TTS] Error messages)
```

## 🎨 Customization Options

### Change Voice (in `server/gcf/index.js`)
```javascript
// Current: Neutral voice
name: 'en-US-Neural2-J'

// Options:
// en-US-Neural2-A - Male, clear
// en-US-Neural2-C - Female, warm
// en-US-Neural2-D - Male, authoritative
// en-US-Neural2-F - Female, friendly
```

### Adjust Speech Rate
```javascript
speakingRate: 0.90,  // Range: 0.25 - 4.0
pitch: 0.0,          // Range: -20.0 - 20.0
```

## 🐛 Known Issues & Solutions

### Issue: TTS falls back to built-in even with paid credits
**Solution**: Check Cloud Function logs for permission errors. Run:
```bash
gcloud projects add-iam-policy-binding beright-app-1021561698058 \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT" \
  --role="roles/cloudtexttospeech.user"
```

### Issue: Audio doesn't play on iOS
**Solution**: Ensure `expo-av` is properly installed:
```bash
npx expo install expo-av
```

## 📊 Monitoring

### Google Cloud Console
- [Text-to-Speech API Usage](https://console.cloud.google.com/apis/api/texttospeech.googleapis.com)
- Track characters processed
- Monitor costs (should be pennies)

### Firestore
- Check `conversationSessions` collection for `isPaid` flags
- Verify paid conversations have `isPaid: true`

## 🎉 Benefits

✅ **Better UX**: Premium users get noticeably better voice quality  
✅ **Value differentiation**: Clear benefit for paying customers  
✅ **Minimal cost**: <3% of revenue per conversation  
✅ **Automatic fallback**: Free users still get narration  
✅ **Scalable**: Google handles infrastructure  
✅ **Flexible**: Easy to change voices or settings  

---

**Ready to deploy?** Follow the steps in `TTS_DEPLOYMENT_GUIDE.md`

*Timestamp: 2025-12-29 16:55 UTC*


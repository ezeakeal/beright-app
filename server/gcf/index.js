// Google Cloud Function (Gen 2) - HTTP-triggered
// Auth: Firebase ID token (Authorization: Bearer <idToken>)
// Quotas: basic per-user per-day count in Firestore, tier-aware (free/pro)

const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildPromptFromAction } = require('./prompts');
try { admin.app(); } catch { admin.initializeApp(); }
// Use named database if provided (e.g., FIRESTORE_DB=beright-db), else default
const db = getFirestore(admin.app(), process.env.FIRESTORE_DB || '(default)');

exports.generateText = async (req, res) => {
  // Basic CORS for web and React Native web; mobile native ignores CORS.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // Read body early to allow special diagnostic actions
    const { prompt, action, payload } = req.body || {};

    // Diagnostic: ping – no auth, no Firestore
    if ((action || '').toLowerCase() === 'ping') {
      return res.json({ ok: true });
    }

    // Require Firebase ID token for all other actions
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }
    const decoded = await admin.auth().verifyIdToken(token);
    const uid = decoded.uid;
    const tier = (decoded.tier || decoded.customClaims?.tier || 'free').toLowerCase();

    // Diagnostic: whoami – verify auth only (no Firestore)
    if ((action || '').toLowerCase() === 'whoami') {
      return res.json({ ok: true, uid, tier });
    }

    // Simple per-user daily quota gating
    const today = new Date();
    const yyyymmdd = [
      today.getUTCFullYear(),
      String(today.getUTCMonth() + 1).padStart(2, '0'),
      String(today.getUTCDate()).padStart(2, '0')
    ].join('');
    const docId = `${uid}-${yyyymmdd}`;
    const usageRef = db.collection('usage').doc(docId);
    const snap = await usageRef.get();
    const currentCount = snap.exists ? (snap.data().count || 0) : 0;
    const freeLimit = Number(process.env.FREE_DAILY_LIMIT || 20);
    const proLimit = Number(process.env.PRO_DAILY_LIMIT || 200);
    const limit = tier === 'pro' ? proLimit : freeLimit;
    if (currentCount >= limit) {
      return res.status(429).json({ error: 'Daily quota exceeded', tier, limit });
    }
    await usageRef.set({
      uid,
      date: yyyymmdd,
      tier,
      count: currentCount + 1,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    // Handle audio transcription and extraction action
    if (action === 'transcribeAndExtract') {
      const { audioData, mimeType } = payload;
      
      // Tiered API keys (optional). Fallback to GEMINI_API_KEY if tiered keys are not set.
      const apiKey =
        tier === 'pro'
          ? (process.env.GEMINI_API_KEY_PRO || process.env.GEMINI_API_KEY)
          : (process.env.GEMINI_API_KEY_FREE || process.env.GEMINI_API_KEY);
      
      // Use Gemini model with audio support
      const model = tier === 'pro' || tier === 'subscribed'
        ? 'gemini-2.5-flash' 
        : 'gemini-2.5-flash';
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      
      const geminiPayload = {
        contents: [{
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: audioData
              }
            },
            {
              text: `Listen to this conversation recording and extract the following information:

1. The main TOPIC being discussed
2. Two distinct VIEWPOINTS or perspectives being debated
3. A full transcript of the conversation

Important:
- If there are more than 2 speakers, identify the 2 most prominent opposing viewpoints
- Each viewpoint should be a clear, concise statement (1-2 sentences)
- If the conversation is unclear or has only one viewpoint, indicate low confidence

Return ONLY a JSON object with this exact structure:
{
  "topic": "The main subject being discussed",
  "viewpointA": "First perspective or position",
  "viewpointB": "Second, opposing perspective or position",
  "transcript": "Full conversation transcript with speaker labels if possible",
  "confidence": "high" | "medium" | "low"
}`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        }
      };
      
      const geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });
      
      const data = await geminiResponse.json();
      
      if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Failed to get response from Gemini');
      }
      
      const text = data.candidates[0].content.parts[0].text;
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      
      return res.json(parsed);
    }

    const finalPrompt = prompt ?? buildPromptFromAction(action, payload);

    // Tiered API keys (optional). Fallback to GEMINI_API_KEY if tiered keys are not set.
    const apiKey =
      tier === 'pro'
        ? (process.env.GEMINI_API_KEY_PRO || process.env.GEMINI_API_KEY)
        : (process.env.GEMINI_API_KEY_FREE || process.env.GEMINI_API_KEY);
    
    // Model selection based on user tier
    let model = 'gemini-2.0-flash-lite'; // Default/Anonymous
    if (tier === 'free') {
      model = 'gemini-2.5-flash-lite';
    } else if (tier === 'pro' || tier === 'subscribed') {
      model = 'gemini-2.5-flash-preview-09-2025';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: String(finalPrompt ?? '') }]}],
      })
    });
    const data = await r.json();

    // Extract model text and return parsed JSON
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.json(parsed);
  } catch (err) {
    // Return full error + stack so the client can display it
    return res.status(500).json({
      error: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
};



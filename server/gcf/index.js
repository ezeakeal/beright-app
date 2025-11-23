// Google Cloud Function (Gen 2) - HTTP-triggered
// Auth: Firebase ID token (Authorization: Bearer <idToken>)
// Quotas: basic per-user per-day count in Firestore, tier-aware (free/pro)

const admin = require('firebase-admin');
try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();

exports.generateText = async (req, res) => {
  // Basic CORS for web and React Native web; mobile native ignores CORS.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Require Firebase ID token
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }
  const decoded = await admin.auth().verifyIdToken(token);
  const uid = decoded.uid;
  const tier = (decoded.tier || decoded.customClaims?.tier || 'free').toLowerCase();

  // Simple per-user daily quota gating (race conditions acceptable for minimal setup)
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
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const { prompt } = req.body || {};

  // Tiered API keys (optional). Fallback to GEMINI_API_KEY if tiered keys are not set.
  const apiKey =
    tier === 'pro'
      ? (process.env.GEMINI_API_KEY_PRO || process.env.GEMINI_API_KEY)
      : (process.env.GEMINI_API_KEY_FREE || process.env.GEMINI_API_KEY);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: String(prompt ?? '') }]}],
    })
  });
  const data = await r.json();

  // Extract model text and return parsed JSON
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const clean = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(clean);

  return res.json(parsed);
};



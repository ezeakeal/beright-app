// Google Cloud Function (Gen 2) - HTTP-triggered
// Auth: per-install device ID (X-Device-Id header)
// Quotas: basic per-device per-day count in Firestore, tier-aware (free/pro)

const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildPromptFromAction } = require('./prompts');
const Stripe = require('stripe');
try { admin.app(); } catch { admin.initializeApp(); }
// Use named database if provided (e.g., FIRESTORE_DB=beright-db), else default
const db = getFirestore(admin.app(), process.env.FIRESTORE_DB || '(default)');

const FREE_DAILY_REQUESTS_PER_DEVICE = 1;
const FREE_POOL_LIMIT = 100;
const UNIT_PRICE_CENTS = 20; // 20c per request
const CURRENCY = 'eur';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_AUDIO_MODEL = 'gemini-2.5-flash';

function yyyymmddUtcNow() {
  const d = new Date();
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('');
}

function requireDeviceId(req) {
  const deviceId = String(req.headers['x-device-id'] || '');
  if (!deviceId) {
    const err = new Error('MISSING_DEVICE_ID');
    err.code = 'MISSING_DEVICE_ID';
    throw err;
  }
  return deviceId;
}

function deviceRef(deviceId) {
  return db.collection('devices').doc(deviceId);
}

function freePoolRef() {
  return db.collection('meta').doc('free_pool');
}

async function getCredits(deviceId) {
  const today = yyyymmddUtcNow();
  const [deviceSnap, poolSnap] = await Promise.all([
    deviceRef(deviceId).get(),
    freePoolRef().get(),
  ]);

  const device = deviceSnap.exists ? deviceSnap.data() : {};
  const pool = poolSnap.exists ? poolSnap.data() : {};

  const paidCredits = Number(device.paidCredits || 0);
  const usedFreeCount = Number(pool.usedFreeCount || 0);
  const freePoolRemaining = Math.max(0, FREE_POOL_LIMIT - usedFreeCount);

  const lastFreeDate = String(device.lastFreeDate || '');
  const deviceFreeRemainingToday =
    lastFreeDate === today ? 0 : FREE_DAILY_REQUESTS_PER_DEVICE;

  const freeAvailable = deviceFreeRemainingToday > 0 && freePoolRemaining > 0;

  return {
    deviceId,
    today,
    paidCredits,
    freeAvailable,
    deviceFreeRemainingToday,
    freePoolRemaining,
    unitPriceCents: UNIT_PRICE_CENTS,
    currency: CURRENCY,
  };
}

async function consumeOneRequestCredit(deviceId) {
  const today = yyyymmddUtcNow();

  return await db.runTransaction(async (tx) => {
    const dRef = deviceRef(deviceId);
    const pRef = freePoolRef();
    const [deviceSnap, poolSnap] = await Promise.all([tx.get(dRef), tx.get(pRef)]);

    const device = deviceSnap.exists ? deviceSnap.data() : {};
    const pool = poolSnap.exists ? poolSnap.data() : {};

    const paidCredits = Number(device.paidCredits || 0);
    const usedFreeCount = Number(pool.usedFreeCount || 0);
    const freePoolRemaining = FREE_POOL_LIMIT - usedFreeCount;
    const lastFreeDate = String(device.lastFreeDate || '');

    if (paidCredits > 0) {
      tx.set(
        dRef,
        {
          paidCredits: paidCredits - 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { mode: 'paid' };
    }

    const deviceCanUseFreeToday = lastFreeDate !== today;
    if (deviceCanUseFreeToday && freePoolRemaining > 0) {
      tx.set(
        dRef,
        {
          lastFreeDate: today,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(
        pRef,
        {
          usedFreeCount: usedFreeCount + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { mode: 'free' };
    }

    const err = new Error('NO_CREDITS');
    err.code = 'NO_CREDITS';
    throw err;
  });
}

exports.generateText = async (req, res) => {
  // Basic CORS for web and React Native web; mobile native ignores CORS.
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id');
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

    const deviceId = requireDeviceId(req);

    // Diagnostic: whoami – verify auth only (no Firestore)
    if ((action || '').toLowerCase() === 'whoami') {
      return res.json({ ok: true, deviceId });
    }

    // Credits info (does not consume)
    if ((action || '').toLowerCase() === 'credits') {
      const credits = await getCredits(deviceId);
      return res.json({ ok: true, credits });
    }

    // Stripe Checkout Session (does not consume)
    if ((action || '').toLowerCase() === 'createcheckoutsession') {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const successUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
      const cancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;
      if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
      if (!successUrl) throw new Error('Missing STRIPE_CHECKOUT_SUCCESS_URL');
      if (!cancelUrl) throw new Error('Missing STRIPE_CHECKOUT_CANCEL_URL');

      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: deviceId,
        metadata: { deviceId },
        line_items: [
          {
            price_data: {
              currency: CURRENCY,
              unit_amount: UNIT_PRICE_CENTS,
              product_data: { name: "B'right Requests" },
            },
            quantity: 1,
            adjustable_quantity: { enabled: true, minimum: 1, maximum: 10000 },
          },
        ],
      });

      return res.json({ ok: true, url: session.url, sessionId: session.id });
    }

    // Consume exactly 1 request credit for all model actions
    await consumeOneRequestCredit(deviceId);

    // Handle audio transcription and extraction action
    if (action === 'transcribeAndExtract') {
      const { audioData, mimeType } = payload;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
      
      // Use Gemini model with audio support
      const model = GEMINI_AUDIO_MODEL;
      
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

Important:
- Identify the 2 most prominent opposing viewpoints
- Each viewpoint should be a clear, concise statement (1-2 sentences)
- If the conversation is unclear or has only one viewpoint, indicate low confidence
- The conversation is supporting a healthy debate, try find the most significant information for both viewpoints.

Return ONLY a JSON object with this exact structure:
{
  "topic": "The main subject being discussed",
  "viewpointA": "First perspective or position",
  "viewpointB": "Second, opposing perspective or position",
  "confidence": "high" | "medium" | "low"
}`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 2046,
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
    
    const model = GEMINI_TEXT_MODEL;

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
    if (err?.code === 'MISSING_DEVICE_ID' || err?.message === 'MISSING_DEVICE_ID') {
      return res.status(401).json({ error: 'Missing X-Device-Id header' });
    }
    if (err?.code === 'NO_CREDITS' || err?.message === 'NO_CREDITS') {
      const deviceId = String(req.headers['x-device-id'] || '');
      const credits = deviceId ? await getCredits(deviceId) : null;
      return res.status(402).json({ error: 'NO_CREDITS', credits });
    }
    // Return full error + stack so the client can display it
    return res.status(500).json({
      error: err?.message || String(err),
      stack: err?.stack || null,
    });
  }
};

exports.stripeWebhook = async (req, res) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
  if (!webhookSecret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');

  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const deviceId = session?.metadata?.deviceId;
    if (!deviceId) throw new Error('Missing deviceId metadata on checkout session');

    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const quantity = Number(items.data?.[0]?.quantity || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid line item quantity');

    await db.runTransaction(async (tx) => {
      const dRef = deviceRef(deviceId);
      const dSnap = await tx.get(dRef);
      const device = dSnap.exists ? dSnap.data() : {};
      const paidCredits = Number(device.paidCredits || 0);
      tx.set(
        dRef,
        {
          paidCredits: paidCredits + quantity,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(
        db.collection('payments').doc(session.id),
        {
          deviceId,
          quantity,
          amountTotal: session.amount_total,
          currency: session.currency,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  return res.json({ received: true });
};



// Google Cloud Function (Gen 2) - HTTP-triggered
// Auth: per-install device ID (X-Device-Id header)
// Quotas: basic per-device per-day count in Firestore, tier-aware (free/pro)

const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { buildPromptFromAction } = require('./prompts');
const Stripe = require('stripe');
const textToSpeech = require('@google-cloud/text-to-speech');
try { admin.app(); } catch { admin.initializeApp(); }
// Use named database if provided (e.g., FIRESTORE_DB=beright-db), else default
const db = getFirestore(admin.app(), process.env.FIRESTORE_DB || '(default)');

const FREE_DAILY_REQUESTS_PER_DEVICE = 1;
const FREE_POOL_LIMIT = 100;
const UNIT_PRICE_CENTS = 20; // 20c per request
const CURRENCY = 'eur';
const GEMINI_TEXT_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_AUDIO_MODEL = 'gemini-2.5-flash';

function getGeminiApiKey() {
  // Common failure mode in Cloud Run: copied key includes whitespace or quotes.
  // Never log the key itself.
  const raw =
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    '';
  const trimmed = String(raw).trim();
  const unquoted = trimmed.replace(/^["']|["']$/g, '');
  if (!unquoted) {
    throw new Error('Missing GEMINI_API_KEY environment variable. Set it in Cloud Run config.');
  }

  // Minimal diagnostics (safe): length and prefix only.
  if (unquoted.length < 20) {
    console.error('[GEMINI] API key looks unexpectedly short. length=', unquoted.length);
  }
  if (!unquoted.startsWith('AIza')) {
    console.error('[GEMINI] API key does not start with expected prefix "AIza". Check if key is correct.');
  }
  return unquoted;
}

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
  const paidCreditsPurchased = Number(device.paidCreditsPurchased || 0);
  const paidCreditsUsed = Number(device.paidCreditsUsed || 0);
  const freeCreditsUsed = Number(device.freeCreditsUsed || 0);
  const usedFreeCount = Number(pool.usedFreeCount || 0);
  const freePoolRemaining = Math.max(0, FREE_POOL_LIMIT - usedFreeCount);
  const lastFreeDate = String(device.lastFreeDate || '');
  const deviceFreeRemainingToday = lastFreeDate === today ? 0 : FREE_DAILY_REQUESTS_PER_DEVICE;
  const freeAvailable = freePoolRemaining > 0 && deviceFreeRemainingToday > 0;

  return {
    deviceId,
    today,
    paidCredits,
    paidCreditsPurchased,
    paidCreditsUsed,
    freeCreditsUsed,
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
    const paidCreditsUsed = Number(device.paidCreditsUsed || 0);
    const freeCreditsUsed = Number(device.freeCreditsUsed || 0);
    const usedFreeCount = Number(pool.usedFreeCount || 0);
    const freePoolRemaining = FREE_POOL_LIMIT - usedFreeCount;

    const lastFreeDate = String(device.lastFreeDate || '');
    const deviceCanUseFreeToday = lastFreeDate !== today;

    // Prefer free (if available) even if the user has paid credits.
    if (deviceCanUseFreeToday && freePoolRemaining > 0) {
      tx.set(
        dRef,
        {
          lastFreeDate: today,
          freeCreditsUsed: freeCreditsUsed + 1,
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
      return { mode: 'free', isPaid: false };
    }

    if (paidCredits > 0) {
      tx.set(
        dRef,
        {
          paidCredits: paidCredits - 1,
          paidCreditsUsed: paidCreditsUsed + 1,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { mode: 'paid', isPaid: true };
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

    // Stripe PaymentIntent for native PaymentSheet (does not consume)
    if ((action || '').toLowerCase() === 'createpaymentintent') {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');

      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

      const quantity = Number(payload?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
        return res.status(400).json({ error: 'Invalid quantity' });
      }

      const amount = Math.round(quantity * UNIT_PRICE_CENTS);
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: CURRENCY,
        metadata: {
          deviceId,
          quantity: String(quantity),
          unitPriceCents: String(UNIT_PRICE_CENTS),
        },
        description: "B'right conversation credits",
      });

      return res.json({ ok: true, clientSecret: paymentIntent.client_secret });
    }

    // Confirm a successful PaymentIntent and credit the device (does not consume)
    // This makes top-ups deterministic even if webhook delivery is delayed/misconfigured.
    if ((action || '').toLowerCase() === 'confirmpaymentintent') {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) throw new Error('Missing STRIPE_SECRET_KEY');
      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

      const clientSecret = String(payload?.clientSecret || '');
      if (!clientSecret) {
        return res.status(400).json({ error: 'Missing clientSecret' });
      }

      // client_secret format: pi_xxx_secret_yyy
      const paymentIntentId = clientSecret.split('_secret_')[0];
      if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
        return res.status(400).json({ error: 'Invalid clientSecret' });
      }

      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (!pi) throw new Error('PaymentIntent not found');
      if (pi.client_secret !== clientSecret) throw new Error('Client secret mismatch');
      if (pi.status !== 'succeeded') {
        return res.status(409).json({ error: `PaymentIntent not succeeded (status=${pi.status})` });
      }

      const piDeviceId = pi?.metadata?.deviceId;
      const quantity = Number(pi?.metadata?.quantity || 0);
      if (!piDeviceId) throw new Error('Missing deviceId metadata on payment_intent');
      if (piDeviceId !== deviceId) throw new Error('Device ID mismatch on payment_intent');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid quantity metadata on payment_intent');
      if (String(pi.currency || '').toLowerCase() !== CURRENCY) {
        throw new Error(`Unexpected currency on payment_intent: ${pi.currency}`);
      }
      const expectedAmount = quantity * UNIT_PRICE_CENTS;
      const received = Number(pi.amount_received ?? pi.amount ?? 0);
      if (received !== expectedAmount) {
        throw new Error(`Amount mismatch. expected=${expectedAmount} received=${received}`);
      }

      await db.runTransaction(async (tx) => {
        const paymentRef = db.collection('payments').doc(pi.id);
        const paymentSnap = await tx.get(paymentRef);
        if (paymentSnap.exists) return;

        const dRef = deviceRef(deviceId);
        const dSnap = await tx.get(dRef);
        const device = dSnap.exists ? dSnap.data() : {};
        const paidCredits = Number(device.paidCredits || 0);
        const paidCreditsPurchased = Number(device.paidCreditsPurchased || 0);

        tx.set(
          dRef,
          {
            paidCredits: paidCredits + quantity,
            paidCreditsPurchased: paidCreditsPurchased + quantity,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        tx.set(
          paymentRef,
          {
            deviceId,
            quantity,
            amountTotal: received,
            currency: String(pi.currency || ''),
            stripePaymentIntentId: pi.id,
            source: 'confirmPaymentIntent',
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      const credits = await getCredits(deviceId);
      return res.json({ ok: true, credits });
    }

    // Start a new conversation: consume 1 credit and return a session token for subsequent calls
    if ((action || '').toLowerCase() === 'startconversation') {
      const creditResult = await consumeOneRequestCredit(deviceId);
      
      // Generate a simple session token (valid for 10 minutes)
      const sessionToken = `${deviceId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
      
      // Store session in Firestore with payment mode
      await db.collection('conversationSessions').doc(sessionToken).set({
        deviceId,
        isPaid: creditResult.isPaid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
      });
      
      const credits = await getCredits(deviceId);
      return res.json({ ok: true, sessionToken, credits, isPaid: creditResult.isPaid });
    }

    // Check if this request has a valid session token (for multi-stage conversations)
    const sessionToken = req.headers['x-session-token'];
    let hasValidSession = false;
    let sessionIsPaid = false;
    
    if (sessionToken) {
      const sessionSnap = await db.collection('conversationSessions').doc(String(sessionToken)).get();
      if (sessionSnap.exists) {
        const session = sessionSnap.data();
        if (session.deviceId === deviceId && session.expiresAt > Date.now()) {
          hasValidSession = true;
          sessionIsPaid = session.isPaid || false;
        }
      }
    }

    // Consume exactly 1 request credit for all model actions (unless covered by session)
    let requestIsPaid = sessionIsPaid;
    if (!hasValidSession) {
      const creditResult = await consumeOneRequestCredit(deviceId);
      requestIsPaid = creditResult.isPaid;
    }

    // Handle audio transcription and extraction action
    if (action === 'transcribeAndExtract') {
      const { audioData, mimeType } = payload;
      
      const apiKey = getGeminiApiKey();
      
      // Use Gemini model with audio support
      const model = GEMINI_AUDIO_MODEL;
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      
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
          // Force the model to emit machine-parseable JSON (no markdown fences).
          responseMimeType: 'application/json',
          maxOutputTokens: 2046,
        }
      };
      
      const geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      });
      
      const data = await geminiResponse.json();
      if (!geminiResponse.ok) {
        console.error('[GEMINI] Audio API error:', {
          status: geminiResponse.status,
          statusText: geminiResponse.statusText,
          error: data?.error?.message || JSON.stringify(data).slice(0, 200)
        });
        throw new Error(
          `Gemini API HTTP ${geminiResponse.status} ${geminiResponse.statusText}. Error: ${data?.error?.message || 'Unknown'}. Body: ${JSON.stringify(data)}`
        );
      }
      
      if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Failed to get response from Gemini');
      }
      
      const text = data.candidates[0].content.parts[0].text;
      const clean = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
      if (!clean) {
        throw new Error(`Gemini returned empty text (audio). Raw response: ${JSON.stringify(data)}`);
      }
      // If JSON.parse fails, we want the exact model output in logs.
      console.error('Gemini (audio) raw text:', String(text).slice(0, 8000));
      console.error('Gemini (audio) clean JSON string:', String(clean).slice(0, 8000));
      const parsed = JSON.parse(clean);
      
      return res.json(parsed);
    }

    // Generate TTS audio (only for paid credits)
    if (action === 'tts') {
      const { text } = payload;

      if (!text) {
        return res.status(400).json({ error: 'Missing text parameter' });
      }

      // Check if this is a paid request
      if (!sessionIsPaid && !requestIsPaid) {
        return res.json({ isPaid: false, audioBase64: null });
      }

      try {
        const ttsClient = new textToSpeech.TextToSpeechClient();
        
        const request = {
          input: { text: String(text).slice(0, 5000) },
          voice: {
            languageCode: 'en-US',
            name: 'en-US-Neural2-F',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.90,
            pitch: 0.0,
          },
        };

        const [response] = await ttsClient.synthesizeSpeech(request);
        const audioBase64 = response.audioContent.toString('base64');
        
        return res.json({ isPaid: true, audioBase64 });
      } catch (ttsError) {
        console.error('[TTS] Error:', ttsError?.message || String(ttsError));
        return res.json({ isPaid: true, audioBase64: null, error: 'TTS generation failed' });
      }
    }

    const finalPrompt = prompt ?? buildPromptFromAction(action, payload);

    const apiKey = getGeminiApiKey();
    
    const model = GEMINI_TEXT_MODEL;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: String(finalPrompt ?? '') }]}],
        generationConfig: {
          temperature: 0.3,
          // Most failures here are "valid JSON prompt, truncated JSON response".
          // Force JSON mode and allow enough output tokens for the staged payloads.
          responseMimeType: 'application/json',
          maxOutputTokens: 4096,
        },
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[GEMINI] Text API error:', {
        status: r.status,
        statusText: r.statusText,
        error: data?.error?.message || JSON.stringify(data).slice(0, 200)
      });
      throw new Error(`Gemini API HTTP ${r.status} ${r.statusText}. Error: ${data?.error?.message || 'Unknown'}. Body: ${JSON.stringify(data)}`);
    }

    // Extract model text and return parsed JSON
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = String(text).replace(/```json/g, '').replace(/```/g, '').trim();
    if (!clean) {
      throw new Error(`Gemini returned empty text. Raw response: ${JSON.stringify(data)}`);
    }
    // If JSON.parse fails, we want the exact model output in logs.
    console.error('Gemini raw text:', String(text).slice(0, 8000));
    console.error('Gemini clean JSON string:', String(clean).slice(0, 8000));
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
    // Gemini failures are upstream; return 502 so clients don’t treat it as an app bug.
    if (String(err?.message || '').includes('Gemini API HTTP')) {
      return res.status(502).json({
        error: err?.message || String(err),
        stack: err?.stack || null,
      });
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

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const deviceId = pi?.metadata?.deviceId;
    const quantity = Number(pi?.metadata?.quantity || 0);
    if (!deviceId) throw new Error('Missing deviceId metadata on payment_intent');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('Invalid quantity metadata on payment_intent');
    if (String(pi.currency || '').toLowerCase() !== CURRENCY) {
      throw new Error(`Unexpected currency on payment_intent: ${pi.currency}`);
    }
    const expectedAmount = quantity * UNIT_PRICE_CENTS;
    const received = Number(pi.amount_received ?? pi.amount ?? 0);
    if (received !== expectedAmount) {
      throw new Error(`Amount mismatch. expected=${expectedAmount} received=${received}`);
    }

    await db.runTransaction(async (tx) => {
      const paymentRef = db.collection('payments').doc(pi.id);
      const paymentSnap = await tx.get(paymentRef);
      if (paymentSnap.exists) {
        return;
      }

      const dRef = deviceRef(deviceId);
      const dSnap = await tx.get(dRef);
      const device = dSnap.exists ? dSnap.data() : {};
      const paidCredits = Number(device.paidCredits || 0);
      const paidCreditsPurchased = Number(device.paidCreditsPurchased || 0);
      tx.set(
        dRef,
        {
          paidCredits: paidCredits + quantity,
          paidCreditsPurchased: paidCreditsPurchased + quantity,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      tx.set(
        paymentRef,
        {
          deviceId,
          quantity,
          amountTotal: received,
          currency: String(pi.currency || ''),
          stripePaymentIntentId: pi.id,
          source: 'stripeWebhook',
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
  }

  return res.json({ received: true });
};



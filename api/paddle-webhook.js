import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/paddle-webhook
 * Paddle → verify signature → update profiles.plan in Supabase
 *
 * Vercel env (server only):
 *   PADDLE_WEBHOOK_SECRET
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PADDLE_PRICE_GROWTH
 *   PADDLE_PRICE_BUSINESS
 */

export const config = {
  api: { bodyParser: false }
};

function planFromPriceId(priceId) {
  const growth = process.env.PADDLE_PRICE_GROWTH || process.env.VITE_PADDLE_PRICE_GROWTH || '';
  const business = process.env.PADDLE_PRICE_BUSINESS || process.env.VITE_PADDLE_PRICE_BUSINESS || '';
  if (priceId && business && priceId === business) return 'business';
  if (priceId && growth && priceId === growth) return 'growth';
  return null;
}

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;
  const parts = {};
  String(signatureHeader).split(';').forEach(function (p) {
    const idx = p.indexOf('=');
    if (idx > 0) parts[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
  });
  if (!parts.ts || !parts.h1) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(parts.ts + ':' + rawBody, 'utf8')
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(parts.h1, 'hex'), Buffer.from(expected, 'hex'));
  } catch (e) {
    return false;
  }
}

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    if (typeof req.body === 'string') return resolve(req.body);
    const chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () { resolve(Buffer.concat(chunks).toString('utf8')); });
    req.on('error', reject);
  });
}

function extractFromEvent(event) {
  const data = (event && event.data) || {};
  const custom = data.custom_data || {};
  const email = custom.email || (data.customer && data.customer.email) || null;
  const userId = custom.user_id || custom.supabase_user_id || null;
  const customerId = data.customer_id || (data.customer && data.customer.id) || null;
  let priceId = null;
  const items = data.items || [];
  if (items.length) {
    priceId = items[0].price_id || (items[0].price && items[0].price.id) || null;
  }
  return { email: email, userId: userId, customerId: customerId, priceId: priceId };
}

async function setPlan(opts) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const patch = { plan: opts.plan || 'starter' };
  if (opts.customerId) patch.paddle_customer_id = opts.customerId;

  if (opts.userId) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', opts.userId);
    if (error) throw error;
    return { matched: 'user_id', userId: opts.userId, plan: patch.plan };
  }

  if (opts.email) {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) throw listErr;
    const user = (list.users || []).find(function (u) {
      return (u.email || '').toLowerCase() === String(opts.email).toLowerCase();
    });
    if (!user) return { matched: 'none', email: opts.email, warning: 'No auth user for email' };
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
    if (error) throw error;
    return { matched: 'email', userId: user.id, plan: patch.plan };
  }

  if (opts.customerId) {
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('paddle_customer_id', opts.customerId);
    if (error) throw error;
    return { matched: 'paddle_customer_id', customerId: opts.customerId, plan: patch.plan };
  }

  return { matched: 'none', warning: 'No user_id, email, or customer_id' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.PADDLE_WEBHOOK_SECRET || '';
  const signature = req.headers['paddle-signature'] || '';
  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch (e) {
    rawBody = req.body ? JSON.stringify(req.body) : '';
  }

  if (secret) {
    if (!verifyPaddleSignature(rawBody, signature, secret)) {
      console.error('Invalid Paddle signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  let event;
  try {
    event = rawBody ? JSON.parse(rawBody) : req.body;
  } catch (e) {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const eventType = event.event_type || event.eventType || '';
  const extracted = extractFromEvent(event);

  try {
    if (
      eventType === 'transaction.completed' ||
      eventType === 'subscription.activated' ||
      eventType === 'subscription.updated'
    ) {
      const plan = planFromPriceId(extracted.priceId) || 'growth';
      const result = await setPlan({
        email: extracted.email,
        userId: extracted.userId,
        customerId: extracted.customerId,
        plan: plan
      });
      console.log('Plan updated', eventType, result);
      res.status(200).json({ ok: true, eventType: eventType, result: result });
      return;
    }

    if (eventType === 'subscription.canceled' || eventType === 'subscription.past_due') {
      const result = await setPlan({
        email: extracted.email,
        userId: extracted.userId,
        customerId: extracted.customerId,
        plan: 'starter'
      });
      console.log('Plan downgraded', eventType, result);
      res.status(200).json({ ok: true, eventType: eventType, result: result });
      return;
    }

    res.status(200).json({ ok: true, ignored: eventType });
  } catch (err) {
    console.error('Webhook error', err);
    res.status(500).json({ error: err.message || 'Webhook failed' });
  }
}

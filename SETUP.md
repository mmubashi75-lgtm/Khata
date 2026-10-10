# Go live checklist (ready to sell)

You already have: Supabase tables, URL, anon key, Paddle client token, env, 3 price IDs, 7-day trial.

## 1. Add only these extra keys (server / Vercel)

| Key | Where | Why |
|-----|--------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (secret) | Webhook updates `profiles.plan` |
| `PADDLE_WEBHOOK_SECRET` | Vercel env (secret) | Verify Paddle webhooks |
| `SUPABASE_URL` | Vercel env | Same as your project URL (server) |
| `PADDLE_PRICE_STARTER` | Vercel env | Same value as `VITE_PADDLE_PRICE_STARTER` |
| `PADDLE_PRICE_GROWTH` | Vercel env | Same as client growth price id |
| `PADDLE_PRICE_BUSINESS` | Vercel env | Same as client business price id |

Client keys (you already have) — also set on Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PADDLE_CLIENT_TOKEN`
- `VITE_PADDLE_ENV` = `production` (or `sandbox` for tests)
- `VITE_PADDLE_PRICE_STARTER` / `_GROWTH` / `_BUSINESS`

## 2. Paddle notification URL

In Paddle → Developer tools → Notifications:

`https://YOUR_DOMAIN/api/paddle-webhook`

Events: `transaction.completed`, `subscription.activated`, `subscription.updated`, `subscription.canceled`

## 3. Local check then push

```bash
unzip KhataPK.zip
cd khatapk
cp .env.example .env.local
# paste your VITE_* keys into .env.local
npm install
npm run dev
```

Open http://localhost:5173 → login → Settings plan buttons should open Paddle checkout.

```bash
git init   # if needed
git add .
git commit -m "KhataPK live"
# connect repo to Vercel, add ALL env vars above, deploy
```

Or: `npx vercel --prod` after logging in and setting env vars.

## 4. Pricing (USD)

| Plan | Price |
|------|-------|
| Starter | **$3 / month** |
| Growth | **$6 / month** |
| Business | **$15 / month** |

Trial: 7 days (configured in Paddle on each price).

## 5. After deploy — smoke test

1. Sign up with a real email  
2. Choose Growth → complete sandbox or live checkout  
3. Confirm Paddle webhook delivery (Paddle dashboard)  
4. Confirm `profiles.plan` = `growth` in Supabase  

You do **not** need the in-app “SaaS integrations” form for customers. Keys come from Vercel env via `public/js/env.js` at build time.

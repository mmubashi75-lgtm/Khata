# KhataPK

Pakistan-first digital khata for kirana stores, wholesalers, mechanics, retailers and distributors.

**Promise:** Track every customer's udhaar without the notebook.

## Requirements

- Node.js 18+

## Quick start

```bash
cd khatapk
npm install
npm run dev
```

Opens at http://localhost:5173

| Page | URL |
|------|-----|
| Landing | `/` or `/index.html` |
| Login | `/login.html` |
| App | `/app.html` |
| Pricing | `/pricing.html` |

Demo login is prefilled on the login page. Without Supabase keys, auth uses a local session so the product works offline.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm start` | Preview, host-accessible |

## Project structure

```
khatapk/
├── package.json
├── vite.config.js
├── index.html          # Landing
├── login.html
├── app.html            # Main ledger UI
├── pricing.html
├── css/app.css
├── js/
│   ├── app.js
│   ├── auth.js         # Supabase + local session
│   ├── config.js
│   ├── i18n.js         # EN / Urdu
│   ├── paddle.js       # Paddle Billing
│   └── store.js        # Local ledger + seed data
├── sql/schema.sql      # Supabase tables + RLS + staff
├── public/
├── .env.example
└── README.md
```

## Go live (SaaS)

1. Create a Supabase project. Run `sql/schema.sql` in the SQL editor. Enable Email auth.
2. Create a Paddle Billing account (sandbox first). Create prices; copy price IDs and client token.
3. Sign into the app → Settings → Integrations → paste Supabase URL, anon key, Paddle token.
4. Deploy:

```bash
npm run build
```

Upload the `dist/` folder to Cloudflare Pages, Netlify, Vercel, or any static host.

## Features

- Customers & suppliers — phone, address, notes, due date, reminder cadence
- Credit, payment, purchase, pay-supplier, signed adjustment
- Running balance, receivable / payable / collection rate
- WhatsApp: balance, reminder, statement
- Cash book
- PIN lock, activity log, JSON backup / restore
- Paddle checkout hook
- Supabase auth hook + RLS schema (staff shop members)
- Staff roles: owner / manager / munshi
- JazzCash, Easypaisa, Raast collection sheet
- English ↔ Nastaliq Urdu toggle

## License

MIT

## Paddle webhook (Vercel)

Live payments need a webhook so paid users get the right plan.

1. Deploy to Vercel.
2. In Vercel project → Settings → Environment Variables, set:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `PADDLE_WEBHOOK_SECRET`
   - `PADDLE_PRICE_GROWTH` / `PADDLE_PRICE_BUSINESS` (your Paddle price IDs)
3. In Paddle Dashboard → Developer tools → Notifications, add:
   - URL: `https://YOUR_DOMAIN/api/paddle-webhook`
   - Events: `transaction.completed`, `subscription.activated`, `subscription.updated`, `subscription.canceled`
4. Run `sql/schema.sql` so `profiles.plan` and `profiles.paddle_customer_id` exist.

Flow: user pays → Paddle hits webhook → plan written to Supabase → app can read plan from profile.

Checkout sends `customData.user_id` + `email` so the webhook can match the user.

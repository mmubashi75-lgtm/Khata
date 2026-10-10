import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const env = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  supabaseAnon: process.env.VITE_SUPABASE_ANON_KEY || '',
  paddleToken: process.env.VITE_PADDLE_CLIENT_TOKEN || '',
  paddleEnv: process.env.VITE_PADDLE_ENV || 'production',
  prices: {
    starter: process.env.VITE_PADDLE_PRICE_STARTER || '',
    growth: process.env.VITE_PADDLE_PRICE_GROWTH || '',
    business: process.env.VITE_PADDLE_PRICE_BUSINESS || ''
  }
};

const out = `window.__KPK_ENV = ${JSON.stringify(env, null, 2)};\n`;
const dest = path.join(root, 'public', 'js', 'env.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('Wrote public/js/env.js');

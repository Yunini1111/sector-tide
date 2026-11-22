// CoinMarketCap client with a single switch between offline fixtures and the live API.
//   CMC_SOURCE=fixture (default) → reads fetch/fixtures/<name>.json (CMC response format, synthetic values)
//   CMC_SOURCE=live              → calls pro-api.coinmarketcap.com with env CMC_API_KEY (header only)
// Every live call adds status.credit_count to a running total; the key is never logged.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE = (process.env.CMC_SOURCE || 'fixture').toLowerCase();
const KEY = process.env.CMC_API_KEY || '';
const BASE = 'https://pro-api.coinmarketcap.com';
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

if (SOURCE === 'live' && !KEY) { console.error('CMC_SOURCE=live but CMC_API_KEY is not set — nothing fetched.'); process.exit(1); }

export const usage = { credits: 0, calls: [], endpoints: new Set() };
export const redact = (s) => (KEY ? String(s).split(KEY).join('***') : String(s));

/** fixture file name for an API path: /v1/cryptocurrency/category?id=X → category-X */
export function fixtureName(path) {
  const [p, q = ''] = path.split('?');
  const base = p.split('/').filter(Boolean).slice(1).join('-')
    .replace(/^cryptocurrency-/, '').replace(/^global-metrics-quotes-/, 'global-').replace(/^fear-and-greed-/, 'fng-');
  const id = new URLSearchParams(q).get('id');
  return id && base === 'category' ? `${base}-${id}` : base; // posts?id=… share one fixture file
}

export async function cmc(path, label = path) {
  if (SOURCE !== 'live') {
    const f = join(FIX, `${fixtureName(path)}.json`);
    if (!existsSync(f)) throw new Error(`${label}: no fixture ${f}`);
    const body = JSON.parse(readFileSync(f, 'utf8'));
    usage.endpoints.add(path.split('?')[0]);
    return body.data;
  }
  const res = await fetch(BASE + path, { headers: { 'X-CMC_PRO_API_KEY': KEY, Accept: 'application/json' } });
  const body = await res.json().catch(() => null);
  const st = body?.status ?? {};
  if (!res.ok || +(st.error_code ?? 0) !== 0) throw new Error(`${label}: HTTP ${res.status} ${redact(st.error_message ?? '')}`);
  const c = +(st.credit_count ?? 0);
  usage.credits += c;
  usage.calls.push({ path: path.split('?')[0], credits: c });
  usage.endpoints.add(path.split('?')[0]);
  return body.data;
}

/** month-to-date credits used (key/info costs 0); null in fixture mode */
export async function creditsUsed() {
  if (SOURCE !== 'live') return null;
  const info = await cmc('/v1/key/info', 'key-info');
  return { used: info?.usage?.current_month?.credits_used ?? null, left: info?.usage?.current_month?.credits_left ?? null };
}

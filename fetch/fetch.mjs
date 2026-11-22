// Hourly snapshot builder. Calls the CoinMarketCap API and writes display-only JSON
// (public/data/snapshot.json + history.json). The API key is read from env CMC_API_KEY
// and sent only as a request header; it is never logged or written.
//
// Credit guard: checks /v1/key/info first (free). Drill-downs into sector constituents are
// rotated a few per run, and skipped entirely when the monthly balance runs low.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECTORS } from './sectors.mjs';

const KEY = process.env.CMC_API_KEY;
const OUT = process.env.OUT_DIR || 'public/data';
const PREV = process.env.PREV_BASE || OUT; // URL of the live site's data/ or a local dir
const DRILL_PER_RUN = +(process.env.DRILL_PER_RUN ?? 4);
const COINS_PER_SECTOR = +(process.env.COINS_PER_SECTOR ?? 15);
const MIN_CREDITS_LEFT = +(process.env.MIN_CREDITS_LEFT ?? 3000);
const HISTORY_HOURS = +(process.env.HISTORY_HOURS ?? 168);
const BASE = 'https://pro-api.coinmarketcap.com';

if (!KEY) { console.error('CMC_API_KEY is not set — nothing fetched.'); process.exit(1); }

const redact = (s) => String(s).split(KEY).join('***');
let credits = 0;
const endpoints = new Set();

async function cmc(path, label) {
  const res = await fetch(BASE + path, { headers: { 'X-CMC_PRO_API_KEY': KEY, Accept: 'application/json' } });
  const body = await res.json().catch(() => null);
  const st = body?.status ?? {};
  const code = +(st.error_code ?? 0);
  if (!res.ok || code !== 0) throw new Error(`${label}: HTTP ${res.status} ${redact(st.error_message ?? '')}`);
  credits += +(st.credit_count ?? 0);
  endpoints.add(path.split('?')[0]);
  return body.data;
}

async function loadPrev(name, fallback) {
  try {
    if (/^https?:/.test(PREV)) {
      const r = await fetch(`${PREV.replace(/\/$/, '')}/${name}`, { cache: 'no-store' });
      return r.ok ? await r.json() : fallback;
    }
    const p = join(PREV, name);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback;
  } catch { return fallback; }
}

const isStable = (c) => (c.tags || []).some((t) => /stablecoin/.test(t)) || /^(USDT|USDC|DAI|FDUSD|USDE|PYUSD|TUSD|USDS)$/.test(c.symbol);
const r2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);

async function main() {
  const prevSnap = await loadPrev('snapshot.json', null);
  const prevHist = prevSnap?.synthetic ? { points: [] } : await loadPrev('history.json', { points: [] });
  const prevById = new Map((prevSnap?.synthetic ? [] : prevSnap?.sectors ?? []).map((s) => [s.id, s]));

  // 0. credit guard (key/info costs 0 credits)
  const info = await cmc('/v1/key/info', 'key-info');
  const left = info?.usage?.current_month?.credits_left ?? Infinity;
  if (left < MIN_CREDITS_LEFT) {
    console.log(`credits left ${left} < ${MIN_CREDITS_LEFT}: skipping this run, previous snapshot stays live.`);
    return;
  }

  // 1. categories (1 credit) → curated sectors
  const cats = await cmc('/v1/cryptocurrency/categories?limit=5000', 'categories');
  const picked = [];
  for (const s of SECTORS) {
    const c = s.match.map((m) => cats.find((x) => x.name === m)).find(Boolean);
    if (!c) { console.warn(`sector not found on CMC: ${s.key}`); continue; }
    picked.push({ s, c });
  }

  // 2. market context (1 credit each)
  const g = await cmc('/v1/global-metrics/quotes/latest', 'global-metrics');
  let fng = null;
  try { fng = await cmc('/v3/fear-and-greed/latest', 'fear-and-greed'); } catch (e) { console.warn(redact(e.message)); }

  // 3. constituents: refresh the stalest few sectors this run
  // first run (no previous snapshot) drills every sector once; later runs rotate a few
  const drillBudget = left < MIN_CREDITS_LEFT + 1000 ? 0 : prevById.size ? DRILL_PER_RUN : SECTORS.length;
  const stalest = [...picked]
    .sort((a, b) => (prevById.get(a.s.key)?.coinsAt ?? '').localeCompare(prevById.get(b.s.key)?.coinsAt ?? ''))
    .slice(0, drillBudget)
    .map((p) => p.s.key);
  const now = new Date().toISOString();

  const sectors = [];
  for (const { s, c } of picked) {
    const prev = prevById.get(s.key);
    let coins = prev?.coins ?? [];
    let coinsAt = prev?.coinsAt ?? null;
    let change7d = prev?.change7d ?? null;
    if (stalest.includes(s.key)) {
      try {
        const d = await cmc(`/v1/cryptocurrency/category?id=${c.id}&limit=${COINS_PER_SECTOR + 5}`, `category ${s.key}`);
        const list = (d.coins || []).filter((x) => !isStable(x) && x.quote?.USD?.market_cap > 0)
          .sort((a, b) => b.quote.USD.market_cap - a.quote.USD.market_cap).slice(0, COINS_PER_SECTOR);
        coins = list.map((x) => ({
          id: x.id, symbol: x.symbol, name: x.name, slug: x.slug,
          marketCap: Math.round(x.quote.USD.market_cap), price: x.quote.USD.price,
          change24h: r2(x.quote.USD.percent_change_24h), change7d: r2(x.quote.USD.percent_change_7d),
        }));
        const w = coins.reduce((a, x) => a + x.marketCap, 0);
        change7d = w ? r2(coins.reduce((a, x) => a + x.marketCap * (x.change7d ?? 0), 0) / w) : null;
        coinsAt = now;
        await new Promise((r) => setTimeout(r, 1500));
      } catch (e) { console.warn(redact(e.message)); }
    }
    sectors.push({
      id: s.key, name: s.label, tokens: c.num_tokens,
      marketCap: Math.round(c.market_cap), change24h: r2(c.market_cap_change),
      change7d, volume: Math.round(c.volume), volumeChange24h: r2(c.volume_change),
      coins, coinsAt,
    });
  }

  const q = g.quote.USD;
  const snapshot = {
    generatedAt: now,
    market: {
      totalMarketCap: Math.round(q.total_market_cap),
      totalMarketCapChange24h: r2(q.total_market_cap_yesterday_percentage_change),
      totalVolume24h: Math.round(q.total_volume_24h),
      btcDominance: r2(g.btc_dominance), btcDominanceChange24h: r2(g.btc_dominance_24h_percentage_change),
      ethDominance: r2(g.eth_dominance),
      fearGreed: fng ? { value: fng.value, label: fng.value_classification } : null,
    },
    sectors,
    meta: {
      creditsThisRun: credits,
      endpoints: [...endpoints],
      notes: [`Constituents refreshed for ${stalest.length} of ${sectors.length} sectors this run (rotating).`],
    },
  };

  // 4. rolling history: one point per hour, trimmed to the display window
  const point = { t: now, fg: fng?.value ?? null, s: Object.fromEntries(sectors.map((x) => [x.id, [x.marketCap, x.change24h, x.change7d]])) };
  let points = (prevHist.points || []).filter((p) => Date.parse(p.t) > Date.now() - HISTORY_HOURS * 3600e3);
  if (points.length && Date.parse(now) - Date.parse(points[points.length - 1].t) < 30 * 60e3) points.pop();
  points.push(point);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'snapshot.json'), JSON.stringify(snapshot));
  writeFileSync(join(OUT, 'history.json'), JSON.stringify({ points }));
  console.log(`ok: ${sectors.length} sectors, drilled ${stalest.length}, history ${points.length} pts, credits this run ${credits}, month left ≈ ${left - credits}`);
}

main().catch((e) => { console.error('fetch failed, previous snapshot kept:', redact(e.message)); process.exit(1); });

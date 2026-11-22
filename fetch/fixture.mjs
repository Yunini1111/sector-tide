// Offline development data. Writes SYNTHETIC responses in CoinMarketCap's response format to
// fetch/fixtures/, then runs fetch.mjs with CMC_SOURCE=fixture so the exact same transform code
// produces public/data/*.json, and finally seeds a synthetic 7-day history for replay.
// Values are made up; field names and nesting follow the CMC API docs and responses we checked.
// The UI shows a "synthetic" banner whenever this data is loaded.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECTORS } from './sectors.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures');
mkdirSync(FIX, { recursive: true });

let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.6;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const r = (v, d = 6) => +v.toFixed(d);
const now = new Date();
const iso = now.toISOString();
const status = (credits = 1) => ({ timestamp: iso, error_code: 0, error_message: null, elapsed: 10, credit_count: credits, notice: null });
const write = (name, data, credits = 1) =>
  writeFileSync(join(FIX, `${name}.json`), JSON.stringify({ _note: 'SYNTHETIC fixture in CoinMarketCap response format', status: status(credits), data }, null, 1));

// ---- coin universe: each sector gets its own coins plus a few shared ones (like real CMC tags)
const coins = [];
const sectorCoins = new Map();
SECTORS.forEach((s, i) => {
  const drift = gauss() * 1.4;
  const own = Array.from({ length: 14 }, (_, k) => {
    const c = {
      id: 90000 + i * 40 + k,
      name: `${s.label} Token ${String.fromCharCode(65 + k)}`,
      symbol: `${s.key.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase()}${String.fromCharCode(65 + k)}`,
      slug: `${s.key}-token-${k}`,
      tags: [s.key],
      mc: 10 ** (8.3 + rnd() * 2.2 - k * 0.09) * (s.key === 'l1' ? 40 : 1),
      p24: drift + gauss() * 2.2,
      p7: drift * 3 + gauss() * 5,
    };
    coins.push(c);
    return c;
  });
  sectorCoins.set(s.key, own);
});
// overlaps: a few coins also tagged into another sector
for (let i = 0; i < 30; i++) {
  const c = pick(coins); const s = pick(SECTORS);
  if (!c.tags.includes(s.key)) { c.tags.push(s.key); sectorCoins.get(s.key).push(c); }
}
const usd = (c) => ({ price: r(10 ** (rnd() * 4 - 1.5)), volume_24h: r(c.mc * (0.02 + rnd() * 0.2), 2), percent_change_1h: r(gauss() * 0.4), percent_change_24h: r(c.p24), percent_change_7d: r(c.p7), percent_change_30d: r(c.p7 * 2 + gauss() * 8), market_cap: r(c.mc, 2), last_updated: iso });

// ---- /v1/cryptocurrency/categories (+ a noise category the curation must ignore)
const cats = SECTORS.map((s, i) => {
  const list = sectorCoins.get(s.key);
  const mc = list.reduce((a, c) => a + c.mc, 0) * 1.25;
  const ch = list.reduce((a, c) => a + c.mc * c.p24, 0) / list.reduce((a, c) => a + c.mc, 0);
  return { id: `fx${String(i).padStart(4, '0')}`, name: s.match[0], title: s.match[0], description: `Synthetic ${s.label} category`,
    volume: r(mc * (0.03 + rnd() * 0.12), 2), num_tokens: 20 + Math.round(rnd() * 600), avg_price_change: r(ch + gauss()),
    market_cap: r(mc, 2), market_cap_change: r(ch), volume_change: r(gauss() * 25), last_updated: '2021-11-10T10:35:12.354Z' };
});
cats.push({ id: 'fx9001', name: 'Example Ventures Portfolio', title: 'Example Ventures Portfolio', description: 'noise', volume: 1, num_tokens: 5, avg_price_change: 0, market_cap: 5e11, market_cap_change: 0.4, volume_change: 1, last_updated: iso });
write('categories', cats);

// ---- /v1/cryptocurrency/category?id=… (one file per curated sector)
SECTORS.forEach((s, i) => {
  const c = cats[i];
  write(`category-${c.id}`, { ...c, coins: sectorCoins.get(s.key).map((x, k) => ({
    id: x.id, name: x.name, symbol: x.symbol, slug: x.slug, tags: x.tags, num_market_pairs: 50, date_added: '2021-01-01T00:00:00.000Z',
    cmc_rank: 50 + k, is_active: 1, quote: { USD: usd(x) } })) });
});

// ---- /v1/global-metrics/quotes/latest
write('global-latest', { btc_dominance: 58.6, eth_dominance: 10.2, btc_dominance_24h_percentage_change: r(gauss() * 0.2), eth_dominance_24h_percentage_change: r(gauss() * 0.2), last_updated: iso,
  quote: { USD: { total_market_cap: 2.08e12, total_volume_24h: 6.1e10, total_market_cap_yesterday_percentage_change: r(gauss()), last_updated: iso } } });

// ---- /v3/fear-and-greed/latest
write('fng-latest', { value: 31, update_time: iso, value_classification: 'Fear' });

// ---- attention endpoints (narrative view). Shapes follow the CMC docs; hot sectors are planted
// so all four quadrants are populated during development.
const hot = new Set(['ai-agents', 'memes', 'prediction', 'rwa', 'derivatives', 'privacy']);
const weight = (s) => (hot.has(s.key) ? 6 : 1) * (0.4 + rnd());
const weightedSector = () => { const w = SECTORS.map(weight); let t = rnd() * w.reduce((a, b) => a + b, 0); return SECTORS[w.findIndex((x) => (t -= x) < 0)] ?? SECTORS[0]; };

write('content-posts-latest', Array.from({ length: 100 }, (_, i) => {
  const s = weightedSector(); const c = pick(sectorCoins.get(s.key));
  return { id: `post-${i}`, user: { id: `u${i % 37}`, username: `user${i % 37}`, verified: rnd() > 0.8 },
    title: `${c.symbol} ${pick(['looks strong', 'breakout?', 'thread', 'update', 'chart check'])}`, content: 'synthetic',
    post_type: pick(['analysis', 'general', 'news', 'prediction']), created_at: new Date(now - i * 9e5).toISOString(),
    likes: Math.round(rnd() * 400), comments_count: Math.round(rnd() * 60), shares_count: Math.round(rnd() * 20), views: Math.round(rnd() * 9000),
    related_coins: [c.id], tags: [pick(s.kw)], sentiment: pick(['bullish', 'bullish', 'neutral', 'bearish']) };
}));

write('community-trending-token', Array.from({ length: 5 }, (_, i) => { // API caps limit at 5
  const s = weightedSector(); const c = sectorCoins.get(s.key)[Math.floor(rnd() * 5)];
  return { id: c.id, name: c.name, symbol: c.symbol, slug: c.slug, rank: 50 + i, trending_rank: i + 1, trending_score: r(98 - i * 2.8 + gauss(), 1),
    mention_count: Math.round(12000 / (i + 1) ** 0.7), post_count: Math.round(3000 / (i + 1) ** 0.7), engagement_score: Math.round(80000 / (i + 1) ** 0.8),
    sentiment: pick(['positive', 'neutral', 'negative']), sentiment_score: Math.round(30 + rnd() * 60), quote: { USD: { price: 1, percent_change_24h: r(c.p24) } } };
}));

const topicNames = [['AI agents go on-chain', 'ai-agents'], ['Memecoin season talk', 'memes'], ['Prediction markets volume record', 'prediction'],
  ['Tokenized treasuries', 'rwa'], ['Perp DEX wars', 'derivatives'], ['Privacy coins delisting debate', 'privacy'], ['Restaking yields', 'restaking'],
  ['L2 fee cuts', 'l2'], ['GPU compute networks', 'ai'], ['Oracle upgrades', 'oracles'], ['Exchange token burns', 'cex'], ['Gaming launches', 'gaming']];
write('community-trending-topic', topicNames.slice(0, 5).map(([name, key], i) => {
  const s = SECTORS.find((x) => x.key === key);
  return { id: name.toLowerCase().replace(/\W+/g, '-'), name, slug: name.toLowerCase().replace(/\W+/g, '-'), description: 'synthetic topic',
    trending_rank: i + 1, trending_score: r(96 - i * 6 + gauss(), 1), post_count: Math.round(5000 / (i + 1)), comment_count: Math.round(20000 / (i + 1)),
    engagement_score: Math.round(150000 / (i + 1)), sentiment: pick(['positive', 'neutral', 'negative']),
    related_tokens: sectorCoins.get(key).slice(0, 3).map((c) => c.id), tags: [s.kw[0], s.kw[1] ?? s.kw[0]], created_at: iso };
}));

// ---- run the real transform on these fixtures
const out = join(HERE, '..', 'public', 'data');
execFileSync(process.execPath, [join(HERE, 'fetch.mjs')], { stdio: 'inherit', env: { ...process.env, CMC_SOURCE: 'fixture', POSTS_PER_RUN: '1', OUT_DIR: out, PREV_BASE: join(FIX, '__none__') } });

// ---- seed 7 days of synthetic history (2h steps) behind the fresh point
const snap = JSON.parse(readFileSync(join(out, 'snapshot.json'), 'utf8'));
const hist = JSON.parse(readFileSync(join(out, 'history.json'), 'utf8'));
const st = Object.fromEntries(snap.sectors.map((s) => [s.id, { a: rnd() * 6, w: 0.5 + rnd() }]));
const pts = [];
for (let k = 84; k >= 1; k--) {
  const t = new Date(now - k * 2 * 3600e3).toISOString();
  const s = {};
  for (const sec of snap.sectors) {
    const ph = st[sec.id].a + (84 - k) / (9 * st[sec.id].w);
    s[sec.id] = [Math.round(sec.marketCap * (1 + Math.sin(ph) * 0.04 - k * 0.0004)), r(Math.sin(ph) * 3 + gauss() * 0.6, 2), r(Math.cos(ph / 2) * 7 + gauss(), 2)];
  }
  pts.push({ t, fg: null, b: 1, s });
}
hist.points = [...pts, ...hist.points];
writeFileSync(join(out, 'history.json'), JSON.stringify(hist));
console.log(`fixtures → ${FIX}; synthetic history ${hist.points.length} points`);

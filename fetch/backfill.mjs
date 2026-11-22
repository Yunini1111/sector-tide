// One-off: seed history.json with the past 7 days (2-hour steps) so rotation trails and
// replay work from day one. Uses /v2/cryptocurrency/quotes/historical for each sector's
// largest constituents (batched ids; ~1 credit per 100 data points).
//
// Reconstruction: at each step, sector 24h/7d change = market-cap-weighted average of its
// top-N constituents' percent_change_24h / _7d; sector market cap is scaled from today's
// CMC category market cap by those constituents' combined market-cap path.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const KEY = process.env.CMC_API_KEY;
const OUT = process.env.OUT_DIR || 'public/data';
const TOP_N = +(process.env.BACKFILL_TOP_N ?? 5);
const STEPS = +(process.env.BACKFILL_STEPS ?? 84); // 84 × 2h = 7 days
if (!KEY) { console.error('CMC_API_KEY is not set'); process.exit(1); }
const redact = (s) => String(s).split(KEY).join('***');

const snap = JSON.parse(readFileSync(join(OUT, 'snapshot.json'), 'utf8'));
const hist = JSON.parse(readFileSync(join(OUT, 'history.json'), 'utf8'));
if (snap.synthetic) { console.error('snapshot is synthetic; run fetch first'); process.exit(1); }

const members = new Map(snap.sectors.map((s) => [s.id, s.coins.slice(0, TOP_N).map((c) => c.id)]));
const ids = [...new Set([...members.values()].flat())];
console.log(`backfill: ${ids.length} unique coins across ${members.size} sectors`);

const series = new Map(); // coinId -> Map(ts -> {mc, p24, p7})
let credits = 0;
for (let i = 0; i < ids.length; i += 20) {
  const batch = ids.slice(i, i + 20);
  const res = await fetch(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/historical?id=${batch.join(',')}&interval=2h&count=${STEPS}`,
    { headers: { 'X-CMC_PRO_API_KEY': KEY, Accept: 'application/json' } });
  const body = await res.json().catch(() => null);
  if (!body?.status) { console.error(`historical quotes: HTTP ${res.status}`); process.exit(1); }
  if (!res.ok || +body.status.error_code) { console.error(redact(body.status?.error_message)); process.exit(1); }
  credits += body.status.credit_count;
  for (const [id, d] of Object.entries(body.data)) {
    const m = new Map();
    for (const q of (d.quotes || [])) {
      const u = q.quote.USD;
      if (u.market_cap > 0) m.set(q.timestamp, { mc: u.market_cap, p24: u.percent_change_24h, p7: u.percent_change_7d });
    }
    series.set(+id, m);
  }
  await new Promise((r) => setTimeout(r, 2000));
}

const stamps = [...new Set([...series.values()].flatMap((m) => [...m.keys()]))].sort();
const firstLive = hist.points.length ? Date.parse(hist.points[0].t) : Date.now();
const r2 = (v) => Math.round(v * 100) / 100;
const points = [];
for (const ts of stamps) {
  if (Date.parse(ts) > firstLive - 30 * 60e3) continue;
  const s = {};
  for (const sec of snap.sectors) {
    const cs = members.get(sec.id).map((id) => ({ now: [...(series.get(id)?.values() ?? [])].at(-1), at: series.get(id)?.get(ts) })).filter((x) => x.now && x.at);
    if (!cs.length) continue;
    const w = cs.reduce((a, x) => a + x.at.mc, 0);
    const wNow = cs.reduce((a, x) => a + x.now.mc, 0);
    s[sec.id] = [
      Math.round(sec.marketCap * (w / wNow)),
      r2(cs.reduce((a, x) => a + x.at.mc * x.at.p24, 0) / w),
      r2(cs.reduce((a, x) => a + x.at.mc * x.at.p7, 0) / w),
    ];
  }
  points.push({ t: ts, fg: null, b: 1, s });
}

hist.points = [...points, ...hist.points.filter((p) => !p.b)];
writeFileSync(join(OUT, 'history.json'), JSON.stringify(hist));
console.log(`backfill ok: ${points.length} reconstructed points (+${hist.points.length - points.length} live), credits ${credits}`);

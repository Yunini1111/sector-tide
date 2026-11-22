// Writes clearly-labelled SYNTHETIC data for UI development only (no API calls).
// Real data comes from fetch.mjs. The UI shows a banner whenever synthetic=true.
import { mkdirSync, writeFileSync } from 'node:fs';
import { SECTORS } from './sectors.mjs';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.6;

const now = Date.now();
const H = 3600e3;
const base = SECTORS.map((s, i) => ({
  ...s,
  mc: Math.round(10 ** (9 + rnd() * 3.2 - i * 0.04)),
  drift: gauss() * 0.6,
}));

const points = [];
for (let h = 72; h >= 0; h--) {
  const t = new Date(now - h * H).toISOString();
  const s = {};
  for (const b of base) {
    b.mc *= 1 + (b.drift + gauss() * 0.8) / 100 / 6;
    const ch24 = +(b.drift * 2 + Math.sin((72 - h) / 9 + b.mc % 7) * 3 + gauss()).toFixed(2);
    const ch7 = +(b.drift * 6 + Math.cos((72 - h) / 20 + b.mc % 5) * 5).toFixed(2);
    s[b.key] = [Math.round(b.mc), ch24, ch7];
  }
  points.push({ t, fg: Math.round(48 + Math.sin(h / 10) * 12), s });
}
const last = points[points.length - 1];

const sectors = base.map((b, i) => {
  const [mc, ch24, ch7] = last.s[b.key];
  const coins = Array.from({ length: 10 }, (_, k) => {
    const cmc = mc * (0.45 / (k + 1) ** 1.3);
    return {
      id: 1000 + i * 20 + k,
      symbol: `${b.key.slice(0, 3).toUpperCase()}${k + 1}`,
      name: `${b.label} Token ${k + 1}`,
      slug: '',
      marketCap: Math.round(cmc),
      price: +(10 ** (rnd() * 4 - 1)).toFixed(4),
      change24h: +(ch24 + gauss() * 3).toFixed(2),
      change7d: +(ch7 + gauss() * 6).toFixed(2),
    };
  });
  return {
    id: b.key, name: b.label, tokens: 20 + Math.round(rnd() * 400),
    marketCap: mc, change24h: ch24, change7d: ch7,
    volume: Math.round(mc * (0.02 + rnd() * 0.15)),
    volumeChange24h: +(gauss() * 15).toFixed(2),
    coins, coinsAt: last.t,
  };
});

const snapshot = {
  generatedAt: last.t,
  synthetic: true,
  market: {
    totalMarketCap: 3.1e12, totalMarketCapChange24h: 1.2, totalVolume24h: 9.8e10,
    btcDominance: 58.4, btcDominanceChange24h: -0.3, ethDominance: 11.9,
    fearGreed: { value: last.fg, label: 'Neutral' },
  },
  sectors,
  meta: { creditsThisRun: 0, endpoints: [], notes: ['SYNTHETIC fixture for UI development'] },
};

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/snapshot.json', JSON.stringify(snapshot));
writeFileSync('public/data/history.json', JSON.stringify({ points }));
console.log('wrote synthetic fixture:', sectors.length, 'sectors,', points.length, 'history points');

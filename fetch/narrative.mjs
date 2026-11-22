// Narrative map inputs: community attention per sector.
// Attention sources (each optional; any that the plan cannot reach are skipped and flagged):
//   /v1/content/posts/latest        posts → sector via related_coins or tag keywords, weighted by engagement
//   /v1/community/trending/token    trending tokens → sector via constituent ids, weighted by trending_score
//   /v1/community/trending/topic    topics → sector via related_tokens or keywords, weighted by trending_score
// Money stays the sector's own CMC category market-cap / volume change (see fetch.mjs).
import { cmc, redact } from './cmc.mjs';

const words = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
const hasKw = (text, kws) => kws.some((k) => text.includes(` ${k.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `));

async function tryGet(path, label) {
  try { const d = await cmc(path, label); return Array.isArray(d) ? d : null; }
  catch (e) { console.warn(`narrative: ${label} unavailable — ${redact(e.message)}`); return null; }
}

/** @param sectors [{id, kw, coinIds:Set}] */
export async function attention(sectors) {
  const posts = await tryGet('/v1/content/posts/latest?limit=100', 'posts');
  const tokens = await tryGet('/v1/community/trending/token?limit=50', 'trending-token');
  const topics = await tryGet('/v1/community/trending/topic?limit=20', 'trending-topic');
  const available = { posts: !!posts, tokens: !!tokens, topics: !!topics };
  if (!posts && !tokens && !topics) return { available, bySector: null, topics: [] };

  const raw = Object.fromEntries(sectors.map((s) => [s.id, { posts: 0, tokens: 0, topics: 0 }]));
  for (const p of posts ?? []) {
    const text = words(`${p.title} ${(p.tags || []).join(' ')}`);
    const w = 1 + Math.log1p((p.likes || 0) + (p.comments_count || 0) * 2);
    for (const s of sectors) {
      if ((p.related_coins || []).some((id) => s.coinIds.has(+id)) || hasKw(text, s.kw)) raw[s.id].posts += w;
    }
  }
  for (const t of tokens ?? []) {
    for (const s of sectors) if (s.coinIds.has(+t.id)) raw[s.id].tokens += +t.trending_score || 1;
  }
  const topicOut = [];
  for (const t of topics ?? []) {
    const text = words(`${t.name} ${t.description} ${(t.tags || []).join(' ')}`);
    const hit = sectors.filter((s) => (t.related_tokens || []).some((id) => s.coinIds.has(+id)) || hasKw(text, s.kw)).map((s) => s.id);
    for (const id of hit) raw[id].topics += +t.trending_score || 1;
    topicOut.push({ name: String(t.name).slice(0, 80), score: +t.trending_score || 0, sentiment: t.sentiment ?? null, sectors: hit });
  }

  // each source scaled to its max, averaged over the sources we actually have → 0..100
  const keys = Object.keys(available).filter((k) => available[k]);
  const max = Object.fromEntries(keys.map((k) => [k, Math.max(1e-9, ...Object.values(raw).map((r) => r[k]))]));
  const bySector = Object.fromEntries(Object.entries(raw).map(([id, r]) => [id, {
    score: Math.round((keys.reduce((a, k) => a + r[k] / max[k], 0) / keys.length) * 1000) / 10,
    posts: Math.round(r.posts * 10) / 10, tokens: Math.round(r.tokens * 10) / 10, topics: Math.round(r.topics * 10) / 10,
  }]));
  return { available, bySector, topics: topicOut.sort((a, b) => b.score - a.score).slice(0, 10) };
}

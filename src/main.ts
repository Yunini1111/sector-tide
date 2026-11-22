import './style.css';
import type { History, Snapshot } from './types';
import { esc, fmtPct, fmtPrice, fmtTime, fmtUsd, median } from './format';
import { divColor } from './color';
import { renderTreemap, treemapTip, type TreeItem } from './charts/treemap';
import { renderRotation, type RotPoint } from './charts/rotation';
import { renderBars } from './charts/bars';
import { breadth, dominanceBar, gauge, sparkline } from './charts/small';
import { renderNarrative, renderTopics, type NarrPoint } from './charts/narrative';

type Win = '24h' | '7d';
/** colour saturation point per window; recomputed from the data on load (80th pct of today's |change|) */
const DOMAIN: Record<Win, number> = { '24h': 8, '7d': 20 };
const NICE = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40];
function fitDomains() {
  for (const w of ['24h', '7d'] as const) {
    const vals = [
      ...state.snap!.sectors.map((s) => (w === '24h' ? s.change24h : s.change7d)),
    ].filter((v): v is number => v != null && isFinite(v)).map(Math.abs).sort((a, b) => a - b);
    const p80 = vals[Math.floor(vals.length * 0.8)] ?? DOMAIN[w];
    DOMAIN[w] = NICE.find((n) => n >= p80) ?? NICE[NICE.length - 1];
  }
}

/** one row per sector at a point in time — either the live snapshot or a history point */
interface Row { id: string; name: string; mc: number; ch24: number; ch7: number | null; }

const state = {
  snap: null as Snapshot | null,
  hist: { points: [] } as History,
  win: '24h' as Win,
  idx: 0,
  selected: null as string | null,
  tab: 'map',
  screen: 'rotation' as 'rotation' | 'narr',
  playing: 0 as number,
};

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const mobile = () => window.innerWidth < 720;

// ---------- theme ----------
function resolveTheme() {
  const forced = document.documentElement.dataset.theme;
  const dark = forced ? forced === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.resolvedTheme = dark ? 'dark' : 'light';
}
$('#theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.resolvedTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('st-theme', next); } catch { /* storage may be blocked */ }
  resolveTheme(); render();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { resolveTheme(); render(); });
resolveTheme();

// ---------- data ----------
const isLive = () => state.idx >= state.hist.points.length - 1;

function rowsAt(idx: number): Row[] {
  const snap = state.snap!;
  const names = new Map(snap.sectors.map((s) => [s.id, s.name]));
  if (idx >= state.hist.points.length - 1 || !state.hist.points.length) {
    return snap.sectors.map((s) => ({ id: s.id, name: s.name, mc: s.marketCap, ch24: s.change24h, ch7: s.change7d }));
  }
  const p = state.hist.points[idx];
  return Object.entries(p.s)
    .filter(([id]) => names.has(id))
    .map(([id, [mc, ch24, ch7]]) => ({ id, name: names.get(id)!, mc, ch24, ch7 }));
}
const change = (r: Row) => (state.win === '24h' ? r.ch24 : r.ch7);

function rotationPoints(rows: Row[]): RotPoint[] {
  const m24 = median(rows.map((r) => r.ch24));
  const m7 = median(rows.filter((r) => r.ch7 != null).map((r) => r.ch7!));
  return rows.filter((r) => r.ch7 != null).map((r) => ({
    id: r.id, name: r.name, x: r.ch7! - m7, y: r.ch24 - m24, size: r.mc, change: change(r),
  }));
}

function trailFor(id: string | null): { x: number; y: number }[] {
  if (!id || state.hist.points.length < 2) return [];
  const end = Math.min(state.idx, state.hist.points.length - 1);
  const tEnd = Date.parse(state.hist.points[end].t);
  let start = end;
  while (start > 0 && Date.parse(state.hist.points[start - 1].t) >= tEnd - 24 * 3600e3) start--;
  const out: { x: number; y: number }[] = [];
  for (let i = start; i <= end; i++) {
    const p = state.hist.points[i];
    const v = p.s[id];
    if (!v || v[2] == null) continue;
    const all = Object.values(p.s);
    const m24 = median(all.map((a) => a[1]));
    const m7 = median(all.filter((a) => a[2] != null).map((a) => a[2]!));
    out.push({ x: v[2] - m7, y: v[1] - m24 });
  }
  return out;
}

// ---------- tooltip ----------
const tip = $('#tip');
function showTip(html: string, e: PointerEvent | MouseEvent) {
  tip.innerHTML = html; tip.hidden = false;
  tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`;
}
const hideTip = () => { tip.hidden = true; };

function wire(container: HTMLElement, selector: string, tipFor: (id: string) => string | null) {
  container.querySelectorAll<SVGElement>(selector).forEach((node) => {
    const id = node.closest<SVGElement>('[data-id]')!.dataset.id!;
    node.addEventListener('pointermove', (e) => { const h = tipFor(id); if (h && e.pointerType === 'mouse') showTip(h, e); });
    node.addEventListener('pointerleave', hideTip);
    node.addEventListener('click', () => select(id));
    node.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') select(id); });
  });
}

function select(id: string) {
  state.selected = id;
  hideTip();
  render();
  if (mobile()) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- render ----------
function renderContext(rows: Row[]) {
  const m = state.snap!.market;
  const up = rows.filter((r) => change(r) != null && change(r)! > 0).length;
  const fg = m.fearGreed;
  $('#context').innerHTML = `
    <div class="tile">
      <div class="t-k">Fear &amp; Greed</div>
      ${fg ? `<div class="t-row">${gauge(fg.value)}<div><div class="t-v">${fg.value}</div><div class="t-s">${esc(fg.label ?? "")}</div></div></div>` : '<div class="t-s">Unavailable</div>'}
    </div>
    <div class="tile">
      <div class="t-k">BTC dominance</div>
      <div class="t-v">${m.btcDominance != null ? m.btcDominance.toFixed(1) + "%" : "–"}<span class="t-d">${fmtPct(m.btcDominanceChange24h, 2)}</span></div>
      ${dominanceBar(m.btcDominance ?? 0, m.ethDominance ?? 0)}
      <div class="t-legend"><span><i class="d-btc"></i>BTC</span><span><i class="d-eth"></i>ETH ${m.ethDominance != null ? m.ethDominance.toFixed(1) + "%" : "–"}</span><span><i class="d-oth"></i>Other</span></div>
    </div>
    <div class="tile">
      <div class="t-k">Total market cap</div>
      <div class="t-v">${fmtUsd(m.totalMarketCap)}<span class="t-d ${(m.totalMarketCapChange24h ?? 0) >= 0 ? 'pos' : 'neg'}">${fmtPct(m.totalMarketCapChange24h)}</span></div>
      <div class="t-s">24h volume ${fmtUsd(m.totalVolume24h)}</div>
    </div>
    <div class="tile">
      <div class="t-k">Breadth · ${state.win}</div>
      <div class="t-v">${up}<span class="t-of">/ ${rows.length} sectors up</span></div>
      ${breadth(rows.map((r) => change(r) ?? 0), DOMAIN[state.win])}
    </div>`;
}

function renderDetail(rows: Row[]) {
  const el = $('#detail');
  const snap = state.snap!;
  const s = snap.sectors.find((x) => x.id === state.selected);
  const r = rows.find((x) => x.id === state.selected);
  if (!s || !r) { el.innerHTML = ''; return; }
  const coins = [...s.coins].sort((a, b) => (state.win === '24h' ? b.change24h - a.change24h : b.change7d - a.change7d));
  el.innerHTML = `
    <h2>${esc(s.name)} <small>${s.tokens} tokens</small></h2>
    <div class="stats">
      <div><span>Market cap</span><b>${fmtUsd(r.mc)}</b></div>
      <div><span>24h</span><b class="${r.ch24 >= 0 ? 'pos' : 'neg'}">${fmtPct(r.ch24)}</b></div>
      <div><span>7d</span><b class="${(r.ch7 ?? 0) >= 0 ? 'pos' : 'neg'}">${fmtPct(r.ch7)}</b></div>
      <div><span>Volume 24h</span><b>${fmtUsd(s.volume)}</b></div>
    </div>
    <div class="d-body">
      <div class="d-spark"><h3>Market cap, last 7 days</h3><div id="spark"></div></div>
      <div class="d-coins"><h3>Constituents · ${state.win} <small>largest by market cap</small></h3><div id="coins"></div></div>
    </div>`;
  const series = state.hist.points.slice(0, Math.min(state.idx, state.hist.points.length - 1) + 1)
    .filter((p) => p.s[s.id]).map((p) => ({ t: p.t, v: p.s[s.id][0] }));
  sparkline($('#spark'), series, mobile() ? 72 : 96);
  const coinEl = $('#coins');
  renderBars(coinEl, coins.map((c) => ({
    id: String(c.id), label: c.symbol, value: state.win === '24h' ? c.change24h : c.change7d,
  })), { domain: DOMAIN[state.win] * 1.5, rowH: mobile() ? 22 : 24, labelW: mobile() ? 56 : 64, clickable: false });
  coinEl.querySelectorAll<SVGGElement>('.brow').forEach((g) => {
    const c = coins.find((x) => String(x.id) === g.dataset.id)!;
    g.addEventListener('pointermove', (e) => showTip(`<b>${esc(c.name)}</b><span>${fmtPrice(c.price)} · ${fmtUsd(c.marketCap)}</span><span>24h ${fmtPct(c.change24h)} · 7d ${fmtPct(c.change7d)}</span>`, e));
    g.addEventListener('pointerleave', hideTip);
  });
}

function render() {
  if (!state.snap) return;
  const rows = rowsAt(state.idx);
  const live = isLive();
  if (!state.selected || !rows.some((r) => r.id === state.selected)) {
    state.selected = [...rows].sort((a, b) => (change(b) ?? -1e9) - (change(a) ?? -1e9))[0]?.id ?? null;
  }
  const t = live ? state.snap.generatedAt : state.hist.points[state.idx].t;
  $('#when').textContent = live ? 'Live' : fmtTime(t) + (state.hist.points[state.idx].b ? ' · rebuilt' : '');
  $('#when').classList.toggle('past', !live);
  $('#updated').textContent = `Updated ${fmtTime(state.snap.generatedAt)}`;
  $('#rank-win').textContent = state.win;
  $('#scale-lo').textContent = fmtPct(-DOMAIN[state.win], 0);
  $('#scale-hi').textContent = fmtPct(DOMAIN[state.win], 0);
  $('#scale-bar').style.background = `linear-gradient(90deg, ${[-1, -0.5, -0.2, 0, 0.2, 0.5, 1].map((k) => divColor(k * DOMAIN[state.win], DOMAIN[state.win])).join(',')})`;

  renderContext(rows);
  const W = window.innerWidth;
  const sm = mobile();
  if (state.screen === 'narr') { renderNarr(); renderDetail(rows); return; }

  // map
  const tm = $('#treemap');
  const tmW = tm.clientWidth || W;
  const tmH = sm ? Math.round(Math.min(560, tmW * 1.3)) : Math.round(Math.max(380, Math.min(560, tmW * 0.6)));
  const items: TreeItem[] = rows.map((r) => ({ id: r.id, name: r.name, value: r.mc, change: change(r) }));
  renderTreemap(tm, items, { domain: DOMAIN[state.win], selected: state.selected, height: tmH });
  wire(tm, '.cell', (id) => { const it = items.find((i) => i.id === id); return it ? treemapTip(it, state.win) : null; });

  // rotation — same height as the map on wide screens so the row stays flush
  const rot = $('#rotation');
  const rotW = rot.clientWidth || W;
  const rotH = sm ? Math.round(Math.min(480, rotW * 1.05)) : W >= 1100 ? tmH - 36 : rows.length * 24 + 4; // tablet: match the ranking card beside it
  const pts = rotationPoints(rows);
  renderRotation(rot, pts, { selected: state.selected, trail: trailFor(state.selected), height: rotH, domain: DOMAIN[state.win], compact: sm });
  wire(rot, '.bub', (id) => {
    const p = pts.find((q) => q.id === id), r = rows.find((q) => q.id === id);
    return p && r ? `<b>${esc(p.name)}</b><span>24h ${fmtPct(r.ch24)} · 7d ${fmtPct(r.ch7)}</span><span>vs median: ${fmtPct(p.y)} / ${fmtPct(p.x)}</span>` : null;
  });

  // ranking
  const rk = $('#ranking');
  const ranked = [...rows].sort((a, b) => (change(b) ?? -1e9) - (change(a) ?? -1e9));
  renderBars(rk, ranked.map((r) => ({ id: r.id, label: r.name, value: change(r) })), {
    domain: DOMAIN[state.win], selected: state.selected, rowH: sm ? 22 : 24, labelW: sm ? 112 : 128, clickable: true,
  });
  wire(rk, '.brow', (id) => { const r = rows.find((q) => q.id === id); return r ? `<b>${esc(r.name)}</b><span>Mkt cap ${fmtUsd(r.mc)}</span>` : null; });

  renderDetail(rows);
}

// ---------- narratives screen ----------
/** 0–100 percentile rank of each value among the list (ties share the mean rank) */
function pctRank(vals: number[]): number[] {
  const sorted = [...vals].sort((a, b) => a - b);
  return vals.map((v) => {
    const lo = sorted.indexOf(v), hi = sorted.lastIndexOf(v);
    return vals.length > 1 ? (((lo + hi) / 2) / (vals.length - 1)) * 100 : 50;
  });
}

function renderNarr() {
  const snap = state.snap!;
  const secs = snap.sectors.filter((s) => s.heat);
  const none = secs.length < 3;
  document.querySelectorAll<HTMLElement>('.n-quad, .n-topics, .n-rank').forEach((el) => { el.hidden = none; });
  $('.n-none').hidden = !none;
  if (none) return;
  const sm = mobile();
  const heatR = pctRank(secs.map((s) => s.heat!.score));
  const capR = pctRank(secs.map((s) => s.change24h));
  const volR = pctRank(secs.map((s) => s.volumeChange24h));
  const pts: NarrPoint[] = secs.map((s, i) => ({
    id: s.id, name: s.name, heat: heatR[i], money: 0.6 * capR[i] + 0.4 * volR[i], size: s.marketCap, change: s.change24h,
  }));
  const names = new Map(snap.sectors.map((s) => [s.id, s.name]));
  const tp = $('#topics');
  renderTopics(tp, snap.narrative?.topics ?? [], names);
  tp.querySelectorAll<HTMLButtonElement>('.chip').forEach((b) => b.addEventListener('click', () => select(b.dataset.id!)));
  const q = $('#narr');
  const qW = q.clientWidth || window.innerWidth;
  // wide screens: the quadrant fills the row next to the topics card (no dead space under the chart)
  const qH = sm ? Math.round(Math.min(480, qW * 1.05))
    : window.innerWidth >= 1100 ? Math.max(380, tp.offsetHeight - 24)
    : Math.round(Math.max(380, Math.min(540, qW * 0.62)));
  renderNarrative(q, pts, { selected: state.selected, height: qH, domain: DOMAIN['24h'], compact: sm });
  wire(q, '.bub', (id) => {
    const s = secs.find((x) => x.id === id)!;
    const p = pts.find((x) => x.id === id)!;
    return `<b>${esc(s.name)}</b><span>Attention ${Math.round(s.heat!.score)} / 100 · rank ${Math.round(p.heat)}</span><span>24h cap ${fmtPct(s.change24h)} · volume ${fmtPct(s.volumeChange24h, 0)}</span>`;
  });


  const av = snap.narrative?.available;
  $('#heat-src').textContent = av ? [av.posts && 'posts', av.tokens && 'trending tokens', av.topics && 'topics'].filter(Boolean).join(' · ') : '';
  const hr = $('#heatrank');
  const ranked = [...secs].sort((a, b) => b.heat!.score - a.heat!.score);
  const W = hr.clientWidth || 300, rowH = sm ? 22 : 24, labelW = sm ? 112 : 128, valW = 40;
  hr.innerHTML = `<svg width="${W}" height="${ranked.length * rowH + 4}" role="img" aria-label="Attention ranking">${ranked.map((s, i) => {
    const y = i * rowH + 2, w = Math.max(2, (s.heat!.score / 100) * (W - labelW - 12 - valW));
    return `<g class="brow click${s.id === state.selected ? ' sel' : ''}" data-id="${esc(s.id)}" tabindex="0" role="button">
      <rect class="hit" x="0" y="${y}" width="${W}" height="${rowH}"/>
      <text class="blabel" x="${labelW}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(s.name)}</text>
      <rect class="heatbar" x="${labelW + 8}" y="${y + rowH * 0.29}" width="${w}" height="${Math.round(rowH * 0.42)}" rx="3"/>
      <text class="bval" x="${W - 4}" y="${y + rowH / 2 + 4}" text-anchor="end">${Math.round(s.heat!.score)}</text></g>`;
  }).join('')}</svg>`;
  wire(hr, '.brow', (id) => { const s = secs.find((x) => x.id === id)!; return `<b>${esc(s.name)}</b><span>posts ${s.heat!.posts} · trending ${s.heat!.tokens} · topics ${s.heat!.topics}</span>`; });
}

function setScreen(screen: 'rotation' | 'narr') {
  stop();
  state.screen = screen;
  document.body.dataset.screen = screen;
  document.querySelectorAll<HTMLButtonElement>('.views button').forEach((b) => b.toggleAttribute('aria-current', b.dataset.screen === screen));
  if (screen === 'narr') { state.idx = Math.max(0, state.hist.points.length - 1); scrub.value = String(state.idx); }
  setTab(screen === 'narr' ? 'nq' : 'map');
}
document.querySelectorAll<HTMLButtonElement>('.views button').forEach((b) => b.addEventListener('click', () => setScreen(b.dataset.screen as 'rotation' | 'narr')));

// ---------- controls ----------
document.querySelectorAll<HTMLButtonElement>('.seg button').forEach((b) => b.addEventListener('click', () => {
  state.win = b.dataset.win as Win;
  document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  render();
}));

function setTab(tab: string) {
  state.tab = tab;
  document.body.dataset.tab = tab;
  document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String((x as HTMLElement).dataset.tab === tab)));
  render();
}
document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab!)));

const scrub = $<HTMLInputElement>('#scrub');
scrub.addEventListener('input', () => { stop(); state.idx = +scrub.value; render(); });
function stop() { if (state.playing) { clearInterval(state.playing); state.playing = 0; document.body.classList.remove('playing'); } }
$('#play').addEventListener('click', () => {
  if (state.playing) return stop();
  const n = state.hist.points.length;
  if (n < 2) return;
  state.idx = Math.max(0, n - 1 - 48);
  document.body.classList.add('playing');
  state.playing = window.setInterval(() => {
    state.idx++;
    scrub.value = String(state.idx);
    render();
    if (state.idx >= n - 1) stop();
  }, 160);
});

let rz = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(render); });

// ---------- boot ----------
async function boot() {
  document.body.dataset.tab = state.tab;
  document.body.dataset.screen = state.screen;
  try {
    const [snap, hist] = await Promise.all([
      fetch('./data/snapshot.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(`snapshot ${r.status}`); return r.json(); }),
      fetch('./data/history.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : { points: [] })).catch(() => ({ points: [] })),
    ]);
    state.snap = snap; state.hist = hist;
    fitDomains();
  } catch (e) {
    $('main.grid').innerHTML = `<section class="card"><h2>Data unavailable</h2><p class="t-s">The latest snapshot could not be loaded. Try again shortly.</p></section>`;
    return;
  }
  const n = state.hist.points.length;
  scrub.max = String(Math.max(0, n - 1));
  state.idx = Math.max(0, n - 1);
  scrub.value = String(state.idx);
  if (n < 2) document.body.classList.add('no-history');
  $('#synthetic').hidden = !state.snap!.synthetic;
  // Narratives needs community-attention endpoints; hide the screen switch when the plan lacks them
  const hasHeat = state.snap!.sectors.filter((s) => s.heat).length >= 3;
  $('.views').hidden = !hasHeat;
  $('#narr-note').hidden = !hasHeat;
  try { render(); } catch (e) {
    console.error(e);
    $('main.grid').innerHTML = `<section class="card"><h2>Data unavailable</h2><p class="t-s">The snapshot could not be displayed.</p></section>`;
  }
}
boot();

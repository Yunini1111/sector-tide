// Narrative map: attention rank (x) × money-flow rank (y), both 0–100 percentile ranks across sectors.
//   top-right Momentum (talked about + money arriving)   bottom-right Hype (talk, no money)
//   top-left  Quiet build (money, little talk)          bottom-left Cold
import { divColor } from '../color';
import { esc } from '../format';

export interface NarrPoint { id: string; name: string; heat: number; money: number; size: number; change: number | null; }

export function renderNarrative(el: HTMLElement, pts: NarrPoint[], opts: { selected: string | null; height: number; domain: number; compact: boolean }): void {
  const W = Math.max(220, el.clientWidth), H = opts.height;
  const pad = 10;
  const sx = (v: number) => pad + (v / 100) * (W - 2 * pad);
  const sy = (v: number) => pad + ((100 - v) / 100) * (H - 2 * pad);
  const maxSize = Math.max(...pts.map((p) => p.size));
  const rMax = opts.compact ? 15 : 24, rMin = opts.compact ? 4 : 5;
  const r = (s: number) => rMin + Math.sqrt(s / maxSize) * (rMax - rMin);
  const cx = sx(50), cy = sy(50);
  const q = (x: number, y: number, t: string, a: string) => `<text class="quad" x="${x}" y="${y}" text-anchor="${a}">${t}</text>`;

  const order = [...pts].sort((a, b) => b.size - a.size);
  const bubbles = order.map((p) => `<circle class="bub${p.id === opts.selected ? ' sel' : ''}" data-id="${esc(p.id)}" cx="${sx(p.heat)}" cy="${sy(p.money)}" r="${r(p.size)}" fill="${divColor(p.change, opts.domain)}" tabindex="0" role="button" aria-label="${esc(p.name)}"/>`);

  // label the extremes of each quadrant (most talked-about, most money) + selection
  const score = (p: NarrPoint) => Math.abs(p.heat - 50) + Math.abs(p.money - 50);
  const sel = pts.find((p) => p.id === opts.selected);
  const cand = [...pts].sort((a, b) => score(b) - score(a)).slice(0, opts.compact ? 6 : 11);
  if (sel && !cand.includes(sel)) cand.unshift(sel);
  const placed: { x: number; y: number; w: number; h: number }[] = order.map((p) => ({ x: sx(p.heat) - r(p.size), y: sy(p.money) - r(p.size), w: 2 * r(p.size), h: 2 * r(p.size) }));
  const labels: string[] = [];
  for (const p of cand) {
    const tw = p.name.length * 6.6, th = 13;
    const bx = sx(p.heat), by = sy(p.money), br = r(p.size);
    const tries = [[bx + br + 4, by + 4], [bx - br - 4 - tw, by + 4], [bx - tw / 2, by - br - 5], [bx - tw / 2, by + br + 13]];
    for (const [lx, ly] of tries) {
      if (lx < 2 || lx + tw > W - 2 || ly - th < 2 || ly > H - 2) continue;
      const box = { x: lx, y: ly - th + 2, w: tw, h: th };
      const hit = placed.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y);
      if (hit && p !== sel) continue;
      placed.push(box);
      labels.push(`<text class="blab${p === sel ? ' sel' : ''}" x="${lx}" y="${ly}">${esc(p.name)}</text>`);
      break;
    }
  }

  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Attention versus money quadrant">
    <rect class="qbg up" x="${cx}" y="${pad}" width="${W - pad - cx}" height="${cy - pad}"/>
    <rect class="qbg down" x="${pad}" y="${cy}" width="${cx - pad}" height="${H - pad - cy}"/>
    <line class="axis" x1="${pad}" x2="${W - pad}" y1="${cy}" y2="${cy}"/>
    <line class="axis" x1="${cx}" x2="${cx}" y1="${pad}" y2="${H - pad}"/>
    ${q(W - pad - 10, pad + 18, 'Momentum', 'end')}${q(W - pad - 10, H - pad - 10, 'Hype', 'end')}
    ${q(pad + 10, H - pad - 10, 'Cold', 'start')}${q(pad + 10, pad + 18, 'Quiet build', 'start')}
    ${bubbles.join('')}${labels.join('')}
  </svg>`;
}

/** horizontal bars for trending topics, with the sectors each topic maps to */
export function renderTopics(el: HTMLElement, topics: { name: string; score: number; sectors: string[] }[], names: Map<string, string>): void {
  if (!topics.length) { el.innerHTML = '<div class="empty">No trending topics in this snapshot.</div>'; return; }
  const max = Math.max(...topics.map((t) => t.score), 1);
  el.innerHTML = `<ol class="topics">${topics.map((t) => `
    <li><div class="tp-row"><span class="tp-name">${esc(t.name)}</span><span class="tp-val">${Math.round(t.score)}</span></div>
      <div class="tp-bar"><i style="width:${(t.score / max) * 100}%"></i></div>
      ${t.sectors.length ? `<div class="chips">${t.sectors.slice(0, 4).map((id) => `<button class="chip" data-id="${esc(id)}">${esc(names.get(id) ?? id)}</button>`).join('')}</div>` : ''}
    </li>`).join('')}</ol>`;
}

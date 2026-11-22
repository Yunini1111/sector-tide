// Rotation quadrant: x = 7d change vs median sector, y = 24h change vs median sector.
// Sectors rotate clockwise: Improving → Leading → Weakening → Lagging.
import { divColor } from '../color';
import { esc } from '../format';

export interface RotPoint { id: string; name: string; x: number; y: number; size: number; change: number | null; }

export function renderRotation(
  el: HTMLElement,
  pts: RotPoint[],
  opts: { selected: string | null; trail: { x: number; y: number }[]; height: number; domain: number; compact: boolean },
): void {
  const W = Math.max(220, el.clientWidth);
  const H = opts.height;
  const pad = { l: 8, r: 8, t: 8, b: 8 };
  // independent x / y extents from the current points; trail points are clamped to the frame
  const ex = Math.max(1, ...pts.map((p) => Math.abs(p.x))) * 1.2;
  const ey = Math.max(0.5, ...pts.map((p) => Math.abs(p.y))) * 1.2;
  const cl = (v: number, e: number) => Math.max(-e, Math.min(e, v));
  const sx = (v: number) => pad.l + ((cl(v, ex) + ex) / (2 * ex)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + ((ey - cl(v, ey)) / (2 * ey)) * (H - pad.t - pad.b);
  const maxSize = Math.max(...pts.map((p) => p.size));
  const rMax = opts.compact ? 16 : 26, rMin = opts.compact ? 4 : 5;
  const r = (s: number) => rMin + Math.sqrt(s / maxSize) * (rMax - rMin);
  const cx = sx(0), cy = sy(0);

  const quad = (x: number, y: number, label: string, anchor: string) =>
    `<text class="quad" x="${x}" y="${y}" text-anchor="${anchor}">${label}</text>`;

  // bubbles: biggest first so small ones stay clickable on top
  const order = [...pts].sort((a, b) => b.size - a.size);
  const bubbles = order.map((p) => {
    const sel = p.id === opts.selected;
    return `<circle class="bub${sel ? ' sel' : ''}" data-id="${esc(p.id)}" cx="${sx(p.x)}" cy="${sy(p.y)}" r="${r(p.size)}" fill="${divColor(p.change, opts.domain)}" tabindex="0" role="button" aria-label="${esc(p.name)}"/>`;
  });

  // direct labels on the largest few + selection, skipping collisions
  const placed: { x: number; y: number; w: number }[] = [];
  const labelCount = opts.compact ? 5 : 9;
  const labelled = [...order.slice(0, labelCount)];
  const selP = pts.find((p) => p.id === opts.selected);
  if (selP && !labelled.includes(selP)) labelled.unshift(selP);
  const labels: string[] = [];
  for (const p of labelled) {
    const tw = p.name.length * 6.6;
    let lx = sx(p.x) + r(p.size) + 4;
    const ly = sy(p.y) + 4;
    if (lx + tw > W - 4) lx = sx(p.x) - r(p.size) - 4 - tw;
    const hit = placed.some((q) => Math.abs(q.y - ly) < 13 && lx < q.x + q.w && lx + tw > q.x);
    if (hit && p !== selP) continue;
    placed.push({ x: lx, y: ly, w: tw });
    labels.push(`<text class="blab${p === selP ? ' sel' : ''}" x="${lx}" y="${ly}">${esc(p.name)}</text>`);
  }

  let trail = '';
  if (opts.trail.length > 1) {
    const d = opts.trail.map((t, i) => `${i ? 'L' : 'M'}${sx(t.x).toFixed(1)},${sy(t.y).toFixed(1)}`).join('');
    const dots = opts.trail.slice(0, -1).map((t, i) =>
      `<circle class="tdot" cx="${sx(t.x)}" cy="${sy(t.y)}" r="2" opacity="${(0.25 + (0.6 * i) / opts.trail.length).toFixed(2)}"/>`).join('');
    trail = `<path class="trail" d="${d}"/>${dots}`;
  }

  const m = 10;
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sector rotation quadrant">
    <rect class="qbg up" x="${cx}" y="${pad.t}" width="${W - pad.r - cx}" height="${cy - pad.t}"/>
    <rect class="qbg down" x="${pad.l}" y="${cy}" width="${cx - pad.l}" height="${H - pad.b - cy}"/>
    <line class="axis" x1="${pad.l}" x2="${W - pad.r}" y1="${cy}" y2="${cy}"/>
    <line class="axis" x1="${cx}" x2="${cx}" y1="${pad.t}" y2="${H - pad.b}"/>
    ${quad(W - pad.r - m, pad.t + 18, 'Leading', 'end')}
    ${quad(W - pad.r - m, H - pad.b - m, 'Weakening', 'end')}
    ${quad(pad.l + m, H - pad.b - m, 'Lagging', 'start')}
    ${quad(pad.l + m, pad.t + 18, 'Improving', 'start')}
    ${trail}${bubbles.join('')}${labels.join('')}
  </svg>`;
}

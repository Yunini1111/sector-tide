// Squarified treemap: area = market cap, fill = % change on the chosen window.
import { divColor, inkOn } from '../color';
import { esc, fmtPct, fmtUsd } from '../format';

export interface TreeItem { id: string; name: string; value: number; change: number | null; }
interface Rect { x: number; y: number; w: number; h: number; item: TreeItem; }

function worst(row: number[], side: number): number {
  const s = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row), min = Math.min(...row);
  return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
}

function squarify(items: TreeItem[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((a, b) => a + b.value, 0);
  const scale = (w * h) / total;
  const areas = items.map((i) => i.value * scale);
  const out: Rect[] = [];
  let i = 0;
  while (i < items.length) {
    const side = Math.min(w, h);
    const row: number[] = [areas[i]];
    let j = i + 1;
    while (j < items.length && worst([...row, areas[j]], side) <= worst(row, side)) { row.push(areas[j]); j++; }
    const sum = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const cw = sum / h; let cy = y;
      row.forEach((a, k) => { const ch = a / cw; out.push({ x, y: cy, w: cw, h: ch, item: items[i + k] }); cy += ch; });
      x += cw; w -= cw;
    } else {
      const ch = sum / w; let cx = x;
      row.forEach((a, k) => { const cw = a / ch; out.push({ x: cx, y, w: cw, h: ch, item: items[i + k] }); cx += cw; });
      y += ch; h -= ch;
    }
    i = j;
  }
  return out;
}

export function renderTreemap(el: HTMLElement, items: TreeItem[], opts: { domain: number; selected: string | null; height: number }): void {
  const W = Math.max(200, el.clientWidth);
  const H = opts.height;
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  // area ∝ √market cap: Layer 1 (incl. BTC) would otherwise take ~80% of the map
  const rects = squarify(sorted.map((i) => ({ ...i, value: Math.sqrt(i.value) })), 0, 0, W, H)
    .map((r) => ({ ...r, item: sorted.find((s) => s.id === r.item.id)! }));
  const gap = 2;
  const cells = rects.map((r) => {
    const fill = divColor(r.item.change, opts.domain);
    const ink = inkOn(fill);
    const w = Math.max(0, r.w - gap), h = Math.max(0, r.h - gap);
    const big = w > 92 && h > 46;
    const fits = w > 46 && h > 30;
    const nameSize = big ? 14 : 12;
    const maxChars = Math.floor((w - 12) / (nameSize * 0.56));
    const label = r.item.name.length > maxChars ? r.item.name.slice(0, Math.max(3, maxChars - 1)) + '…' : r.item.name;
    const sel = opts.selected === r.item.id;
    return `<g class="cell" data-id="${esc(r.item.id)}" tabindex="0" role="button" aria-label="${esc(r.item.name)} ${fmtPct(r.item.change)}">
      <rect x="${r.x + gap / 2}" y="${r.y + gap / 2}" width="${w}" height="${h}" rx="4" fill="${fill}" ${sel ? 'class="sel"' : ''}/>
      ${fits ? `<text x="${r.x + 8}" y="${r.y + (big ? 22 : 18)}" fill="${ink}" font-size="${nameSize}" font-weight="600">${esc(label)}</text>
      <text x="${r.x + 8}" y="${r.y + (big ? 40 : 32)}" fill="${ink}" font-size="12" opacity=".85">${fmtPct(r.item.change)}</text>` : ''}
    </g>`;
  });
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sector treemap">${cells.join('')}</svg>`;
}

export const treemapTip = (it: TreeItem, windowLabel: string): string =>
  `<b>${esc(it.name)}</b><span>${windowLabel} ${fmtPct(it.change)}</span><span>Mkt cap ${fmtUsd(it.value)}</span>`;

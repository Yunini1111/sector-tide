// Diverging horizontal bars around a zero line. Used for the sector ranking and constituents.
import { divColor } from '../color';
import { esc, fmtPct } from '../format';

export interface BarRow { id: string; label: string; sub?: string; value: number | null; }

export function renderBars(
  el: HTMLElement,
  rows: BarRow[],
  opts: { domain: number; selected?: string | null; rowH: number; labelW: number; clickable: boolean },
): void {
  const W = Math.max(200, el.clientWidth);
  const valW = 54;
  const plotX = opts.labelW + 8, plotW = W - plotX - valW - 4;
  const ext = Math.max(1, ...rows.map((r) => Math.abs(r.value ?? 0)));
  const zero = plotX + plotW / 2;
  const sx = (v: number) => (v / ext) * (plotW / 2);
  const barH = Math.max(4, Math.round(opts.rowH * 0.42));
  const H = rows.length * opts.rowH + 4;
  const g = rows.map((r, i) => {
    const y = i * opts.rowH + 2;
    const v = r.value ?? 0;
    const w = Math.abs(sx(v));
    const x = v >= 0 ? zero : zero - w;
    const sel = opts.selected === r.id;
    const by = y + (opts.rowH - barH) / 2;
    return `<g class="brow${sel ? ' sel' : ''}${opts.clickable ? ' click' : ''}" data-id="${esc(r.id)}" ${opts.clickable ? 'tabindex="0" role="button"' : ''}>
      <rect class="hit" x="0" y="${y}" width="${W}" height="${opts.rowH}"/>
      <text class="blabel" x="${opts.labelW}" y="${y + opts.rowH / 2 + 4}" text-anchor="end">${esc(r.label)}${r.sub ? `<tspan class="bsub"> ${esc(r.sub)}</tspan>` : ''}</text>
      <rect x="${x}" y="${by}" width="${Math.max(1, w)}" height="${barH}" rx="${Math.min(3, barH / 2)}" fill="${divColor(r.value, opts.domain)}"/>
      <text class="bval" x="${W - 4}" y="${y + opts.rowH / 2 + 4}" text-anchor="end">${fmtPct(r.value)}</text>
    </g>`;
  });
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ranked bars">
    <line class="zero" x1="${zero}" x2="${zero}" y1="0" y2="${H}"/>${g.join('')}</svg>`;
}

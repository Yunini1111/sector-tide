// Small context graphics: fear & greed gauge, dominance split, breadth dots, sparkline.
import { divColor } from '../color';
import { esc, fmtTime, fmtUsd } from '../format';

export function gauge(value: number): string {
  const W = 120, H = 66, cx = 60, cy = 60, R = 50;
  const pt = (v: number) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + R * Math.cos(a), cy - R * Math.sin(a)];
  };
  const [x0, y0] = pt(0), [x1, y1] = pt(100), [vx, vy] = pt(value);
  return `<svg class="gauge" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <path class="g-track" d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}"/>
    <path class="g-val" d="M${x0},${y0} A${R},${R} 0 0 1 ${vx.toFixed(1)},${vy.toFixed(1)}"/>
    <circle class="g-dot" cx="${vx.toFixed(1)}" cy="${vy.toFixed(1)}" r="6"/>
  </svg>`;
}

export function dominanceBar(btc: number, eth: number): string {
  const other = Math.max(0, 100 - btc - eth);
  const segs = [['btc', btc], ['eth', eth], ['oth', other]] as const;
  return `<div class="domb" aria-hidden="true">${segs.map(([k, v]) => `<i class="d-${k}" style="flex:${v}"></i>`).join('')}</div>`;
}

export function breadth(changes: number[], domain: number): string {
  const sorted = [...changes].sort((a, b) => b - a);
  return `<div class="dots" aria-hidden="true">${sorted.map((c) => `<i style="background:${divColor(c, domain)}"></i>`).join('')}</div>`;
}

export function sparkline(el: HTMLElement, series: { t: string; v: number }[], height: number): void {
  const W = Math.max(160, el.clientWidth), H = height;
  if (series.length < 2) { el.innerHTML = `<div class="empty">History builds up hourly.</div>`; return; }
  const vs = series.map((s) => s.v);
  const lo = Math.min(...vs), hi = Math.max(...vs);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (series.length - 1)) * (W - 2) + 1;
  const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 10);
  const d = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.v).toFixed(1)}`).join('');
  const up = series[series.length - 1].v >= series[0].v;
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="spark ${up ? 'up' : 'down'}">
    <path class="area" d="${d}L${x(series.length - 1)},${H}L${x(0)},${H}Z"/>
    <path class="line" d="${d}"/>
    <line class="xh" x1="0" x2="0" y1="0" y2="${H}" visibility="hidden"/>
    <circle class="xd" r="4" cx="0" cy="0" visibility="hidden"/>
  </svg>`;
  const svg = el.querySelector('svg')!;
  const xh = svg.querySelector<SVGLineElement>('.xh')!, xd = svg.querySelector<SVGCircleElement>('.xd')!;
  const tip = document.getElementById('tip')!;
  svg.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left) / rect.width) * (series.length - 1));
    const s = series[Math.max(0, Math.min(series.length - 1, i))];
    const px = x(series.indexOf(s)), py = y(s.v);
    xh.setAttribute('x1', `${px}`); xh.setAttribute('x2', `${px}`); xh.setAttribute('visibility', 'visible');
    xd.setAttribute('cx', `${px}`); xd.setAttribute('cy', `${py}`); xd.setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${fmtUsd(s.v)}</b><span>${esc(fmtTime(s.t))}</span>`;
    tip.hidden = false;
    tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`;
  });
  svg.addEventListener('pointerleave', () => { xh.setAttribute('visibility', 'hidden'); xd.setAttribute('visibility', 'hidden'); tip.hidden = true; });
}

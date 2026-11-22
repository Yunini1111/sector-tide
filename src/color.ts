// Diverging scale (down ↔ neutral ↔ up), mixed in OKLab so mid-steps stay even.
type V3 = [number, number, number];

const hex = (h: string): V3 => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as V3;
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab([r, g, b]: V3): V3 {
  const [R, G, B] = [toLin(r), toLin(g), toLin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function fromOklab([L, a, b]: V3): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, toSrgb(c))) * 255).toString(16).padStart(2, '0')).join('');
}
const mix = (a: string, b: string, t: number): string => {
  const A = toOklab(hex(a)), B = toOklab(hex(b));
  return fromOklab([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
};

const PALETTES = {
  light: { down: '#c8343a', mid: '#e4e2dc', up: '#0e8a5c' },
  dark: { down: '#e25c5c', mid: '#3b3a36', up: '#27b47f' },
};

export const isDark = (): boolean => document.documentElement.dataset.resolvedTheme === 'dark';

/** pct → fill colour, saturating at ±domain; easing keeps small moves visible */
export function divColor(pct: number | null, domain: number): string {
  const p = isDark() ? PALETTES.dark : PALETTES.light;
  if (pct == null || !isFinite(pct)) return p.mid;
  const t = Math.min(1, Math.abs(pct) / domain) ** 0.75;
  return mix(p.mid, pct >= 0 ? p.up : p.down, t);
}

/** ink that stays readable on a given fill */
export function inkOn(fill: string): string {
  const [r, g, b] = hex(fill).map(toLin);
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return Y > 0.22 ? '#141414' : '#fbfbfa';
}

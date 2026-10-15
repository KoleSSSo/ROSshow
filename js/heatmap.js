/** Шкала как у облака точек: фиолетовый → синий → голубой → зелёный → жёлтый → оранжевый. */
const STOPS = [
  { at: 0, rgb: [88, 28, 135] },
  { at: 0.18, rgb: [59, 76, 192] },
  { at: 0.36, rgb: [34, 168, 220] },
  { at: 0.54, rgb: [46, 204, 113] },
  { at: 0.72, rgb: [241, 196, 15] },
  { at: 0.86, rgb: [243, 156, 18] },
  { at: 1, rgb: [231, 76, 60] },
];

const LIGHT_STOPS = [
  { at: 0, rgb: [76, 29, 149] },
  { at: 0.18, rgb: [29, 78, 216] },
  { at: 0.36, rgb: [3, 105, 161] },
  { at: 0.54, rgb: [6, 95, 70] },
  { at: 0.72, rgb: [133, 77, 14] },
  { at: 0.86, rgb: [154, 52, 18] },
  { at: 1, rgb: [153, 27, 27] },
];

const COLOR_CACHE = { dark: new Array(49), light: new Array(49) };

export function heatColor(amount, light = false) {
  const step = Math.round(Math.min(1, Math.max(0, amount)) * 48);
  const cache = light ? COLOR_CACHE.light : COLOR_CACHE.dark;
  const cached = cache[step];
  if (cached) {
    return cached;
  }
  const stops = light ? LIGHT_STOPS : STOPS;
  const t = step / 48;
  let left = stops[0];
  let right = stops[stops.length - 1];

  for (let index = 1; index < stops.length; index += 1) {
    if (t <= stops[index].at) {
      left = stops[index - 1];
      right = stops[index];
      break;
    }
  }

  const span = right.at - left.at || 1;
  const mix = (t - left.at) / span;
  const rgb = left.rgb.map((channel, index) =>
    Math.round(channel + (right.rgb[index] - channel) * mix),
  );

  const color = `rgb(${rgb.join(", ")})`;
  cache[step] = color;
  return color;
}

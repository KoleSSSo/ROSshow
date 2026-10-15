const numberFormat = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

const secondFormat = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatNumber(value) {
  return numberFormat.format(value);
}

export function formatSeconds(value) {
  return secondFormat.format(value);
}

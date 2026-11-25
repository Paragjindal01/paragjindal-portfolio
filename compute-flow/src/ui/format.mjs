export function format(value, digits = 1) {
  return value == null ? '—' : new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
}

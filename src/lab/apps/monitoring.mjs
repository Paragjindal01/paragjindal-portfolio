import { createSnapshot } from '../simulator.mjs';

export function scenarioWindow({ scenario, step }, size = 24) {
  const firstStep = Math.max(0, step - size + 1);
  return Array.from({ length: size }, (_, offset) => createSnapshot({ scenario, step: firstStep + offset }));
}

export function downloadReport(filename, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const formulaLike = /^[\s\p{Cf}]*[=+\-@＝＋－＠]|^[\t\r\n]/u;

export function toCsv(rows) {
  return rows.map((row) => row.map((value) => {
    let field = String(value ?? '');
    if (typeof value === 'string' && formulaLike.test(field)) field = "'" + field;
    return '"' + field.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n') + '\r\n';
}

export function percent(used, capacity) {
  return capacity > 0 ? (used / capacity) * 100 : 0;
}

export function decimal(value, digits = 0) {
  return value.toFixed(digits);
}

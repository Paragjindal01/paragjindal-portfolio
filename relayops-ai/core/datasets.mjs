import { isRecord } from './contracts.mjs';

const MAX_COLUMNS = 40;
const MAX_ROWS = 1000;
const MAX_CHARS = 60_000;
const MAX_CELL = 512;
const numericCell = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;
const reservedColumns = new Set(['__proto__', 'constructor', 'prototype']);
const chartPoints = 24;

function csvCells(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let quoteClosed = false;
  function closeField() {
    if (field.length > MAX_CELL || row.length === MAX_COLUMNS) throw new Error('CSV contains too many columns or a field that is too long.');
    row.push(field);
    field = '';
    quoteClosed = false;
  }
  function closeRow() {
    closeField();
    if (row.some((cell) => cell !== '') || row.length > 1) rows.push(row);
    row = [];
    if (rows.length > MAX_ROWS + 1) throw new Error('Dataset exceeds 1,000 rows.');
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        quoteClosed = true;
      } else {
        field += c;
      }
      continue;
    }
    if (c === ',') closeField();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      closeRow();
    } else if (c === '"' && !quoteClosed && field === '') quoted = true;
    else if (c === '"' || quoteClosed) throw new Error('Invalid CSV quoting.');
    else field += c;
  }
  if (quoted) throw new Error('CSV has an unclosed quoted field.');
  if (field !== '' || row.length || quoteClosed) closeRow();
  return rows;
}

function validHeader(header) {
  return typeof header === 'string' && header.trim() === header && header.length > 0 &&
    header.length <= 80 && !/[\u0000-\u001f]/.test(header) && !reservedColumns.has(header);
}
function checkHeaders(headers) {
  if (!headers.length || headers.length > MAX_COLUMNS || !headers.every(validHeader) || new Set(headers).size !== headers.length) {
    throw new Error('Dataset requires 1–40 unique, valid column names.');
  }
}
function cleanCell(raw) {
  if (raw === null || typeof raw === 'boolean' || (Number.isFinite(raw) && Math.abs(raw) <= 1e12)) return raw;
  if (typeof raw !== 'string' || raw.length > MAX_CELL || raw.includes('\u0000')) throw new Error('Dataset cells must be bounded text, finite numbers, booleans, or null.');
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!numericCell.test(trimmed)) return raw;
  const number = Number(trimmed);
  if (!Number.isFinite(number) || Math.abs(number) > 1e12) throw new Error('Numeric values are outside the supported range.');
  return number;
}

export function parseDataset(input) {
  if (!isRecord(input) || !['csv', 'json'].includes(input.format)) throw new Error('Choose CSV or JSON dataset format.');
  const data = input.dataset;
  if (typeof data === 'string' && data.length > MAX_CHARS) throw new Error('The dataset exceeds 60,000 characters.');
  let headers;
  let raw;
  if (input.format === 'csv') {
    if (typeof data !== 'string') throw new Error('CSV input must be text.');
    const [header, ...rows] = csvCells(data.replace(/^\uFEFF/, ''));
    headers = (header || []).map((value) => value.trim());
    raw = rows;
  } else {
    let records = data;
    if (typeof records === 'string') {
      try { records = JSON.parse(records); } catch { throw new Error('The JSON dataset could not be parsed.'); }
    }
    if (!Array.isArray(records) || !records.length || records.length > MAX_ROWS || !records.every(isRecord)) throw new Error('JSON datasets need 1–1,000 flat records.');
    headers = Object.keys(records[0]);
    checkHeaders(headers);
    if (records.some((row) => Object.keys(row).length !== headers.length || !headers.every((key) => Object.hasOwn(row, key)))) throw new Error('JSON records must share the same columns.');
    raw = records.map((row) => headers.map((key) => row[key]));
  }
  checkHeaders(headers);
  if (!raw.length || raw.length > MAX_ROWS || raw.some((row) => row.length !== headers.length)) throw new Error('Data rows must match the header and contain 1–1,000 records.');
  const rows = raw.map((row) => row.map(cleanCell));
  return { columns: headers, rows, rowCount: rows.length, format: input.format };
}

function percentile(sorted, fraction) {
  const offset = (sorted.length - 1) * fraction;
  const lower = Math.floor(offset);
  return sorted[lower] + (sorted[Math.ceil(offset)] - sorted[lower]) * (offset - lower);
}

const round = (value) => Number(value.toFixed(6));

export function describeDataset(dataset) {
  const { columns, rows } = dataset;
  if (!Array.isArray(columns) || !Array.isArray(rows) || rows.length === 0) throw new Error('Validated rows and columns are required.');
  const metrics = [];
  const anomalies = [];
  const charts = [];
  for (let position = 0; position < columns.length; position++) {
    const present = rows.flatMap((row, index) => typeof row[position] === 'number' ? [{ row: index + 1, value: row[position] }] : []);
    const n = present.length;
    if (!n) continue;
    const sorted = present.map(({ value }) => value).sort((a, b) => a - b);
    const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
    const standardDeviation = Math.sqrt(sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / n);
    const q1 = percentile(sorted, 0.25);
    const q3 = percentile(sorted, 0.75);
    const spread = q3 - q1;
    const lower = q1 - 1.5 * spread;
    const upper = q3 + 1.5 * spread;
    const column = columns[position];
    metrics.push({
      column, count: n, missingOrNonNumeric: rows.length - n, min: sorted[0], max: sorted[n - 1],
      mean: round(mean), median: round(percentile(sorted, 0.5)), standardDeviation: round(standardDeviation),
      q1: round(q1), q3: round(q3), lowerFence: round(lower), upperFence: round(upper),
    });
    if (n >= 4) anomalies.push(...present.filter(({ value }) => value < lower || value > upper).map((entry) => ({ column, ...entry })));
    if (charts.length < 5) {
      const count = Math.min(n, chartPoints);
      charts.push({ column, points: Array.from({ length: count }, (_, index) => present[Math.round(index * (n - 1) / Math.max(1, count - 1))]) });
    }
  }
  return {
    summary: `${rows.length} records, ${metrics.length} numeric columns, and ${anomalies.length} IQR outlier flags.`,
    rowCount: rows.length, metrics, anomalies: anomalies.slice(0, 100), anomalyCount: anomalies.length, charts,
    method: 'Population standard deviation, linearly interpolated quartiles and 1.5× IQR fences. Outlier flags require at least four numeric observations.',
  };
}

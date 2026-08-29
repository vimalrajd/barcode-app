const ExcelJS = require('exceljs');
const { parse: parseCsv } = require('csv-parse/sync');

const SKU_HEADERS = ['sku', 'sku code', 'item code', 'product code', 'barcode', 'item', 'code'];
const MRP_HEADERS = ['mrp', 'price', 'rate', 'mrp (rs)', 'mrp(rs)', 'amount'];
const QTY_HEADERS = ['quantity', 'qty', 'count', 'no of labels', 'labels', 'no. of labels'];

function normalizeHeader(h) {
  return String(h == null ? '' : h).trim().toLowerCase();
}

function findColumn(headers, candidates) {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate);
    if (idx !== -1) return idx;
  }
  for (let i = 0; i < normalized.length; i++) {
    if (candidates.some((c) => normalized[i].includes(c))) return i;
  }
  return -1;
}

function rowsFromMatrix(matrix) {
  if (!matrix.length) throw new Error('The sheet appears to be empty.');
  const headers = matrix[0];
  const skuIdx = findColumn(headers, SKU_HEADERS);
  const mrpIdx = findColumn(headers, MRP_HEADERS);
  const qtyIdx = findColumn(headers, QTY_HEADERS);

  if (skuIdx === -1) throw new Error('Could not find a SKU column in the sheet.');
  if (mrpIdx === -1) throw new Error('Could not find an MRP column in the sheet.');
  if (qtyIdx === -1) throw new Error('Could not find a Quantity column in the sheet.');

  const items = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;

    const sku = String(row[skuIdx] == null ? '' : row[skuIdx]).trim();
    if (!sku) continue;

    const mrpRaw = row[mrpIdx];
    const qtyRaw = row[qtyIdx];

    const mrp = typeof mrpRaw === 'number' ? mrpRaw : parseFloat(String(mrpRaw).replace(/[^0-9.\-]/g, ''));
    const quantity = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw).replace(/[^0-9\-]/g, ''), 10);

    if (!Number.isFinite(mrp)) throw new Error(`Row ${r + 1}: MRP value "${mrpRaw}" is not a valid number.`);
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`Row ${r + 1}: Quantity value "${qtyRaw}" is not a valid whole number.`);
    }

    items.push({ sku, mrp, quantity: Math.floor(quantity) });
  }

  if (!items.length) throw new Error('No valid data rows were found in the sheet.');
  return items;
}

async function parseWorkbookBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook has no sheets.');

  const matrix = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1); // exceljs rows are 1-indexed with a leading empty slot
    const cleaned = values.map((v) => {
      if (v && typeof v === 'object') {
        if (v.text != null) return v.text;
        if (v.result != null) return v.result;
        if (v.richText) return v.richText.map((t) => t.text).join('');
      }
      return v;
    });
    matrix.push(cleaned);
  });

  return rowsFromMatrix(matrix);
}

function parseCsvBuffer(buffer) {
  const records = parseCsv(buffer, {
    skip_empty_lines: true,
    relax_column_count: true,
  });
  return rowsFromMatrix(records);
}

async function parseSheetBuffer(buffer, contentType, filename) {
  const looksCsv =
    (contentType && contentType.includes('csv')) ||
    (filename && /\.csv$/i.test(filename)) ||
    (!filename && !contentType);

  const looksXlsx =
    (contentType && (contentType.includes('spreadsheetml') || contentType.includes('excel'))) ||
    (filename && /\.xlsx?$/i.test(filename));

  if (looksXlsx) return parseWorkbookBuffer(buffer);
  if (looksCsv) return parseCsvBuffer(buffer);

  // Fall back: sniff the signature. XLSX files are zip archives starting with "PK".
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return parseWorkbookBuffer(buffer);
  }
  return parseCsvBuffer(buffer);
}

module.exports = { parseSheetBuffer, parseWorkbookBuffer, parseCsvBuffer, rowsFromMatrix };

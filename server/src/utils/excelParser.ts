import * as XLSX from 'xlsx';

export interface ParsedItem {
  part_number: string;
  description: string;
  qty: number;
  reference_designators: string;
  value: string;
  package: string;
}

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  items: ParsedItem[];
  errors: ParseError[];
}

const COLUMN_MAP: Record<string, string> = {
  'part number': 'part_number',
  'part#': 'part_number',
  'pn': 'part_number',
  'mpn': 'part_number',
  'part': 'part_number',
  'partno': 'part_number',
  'part_no': 'part_number',
  'partnumber': 'part_number',
  'manufacturer part': 'part_number',
  'description': 'description',
  'desc': 'description',
  'descr': 'description',
  'comment': 'description',
  'qty': 'qty',
  'quantity': 'qty',
  'count': 'qty',
  'qty.': 'qty',
  'qty/per': 'qty',
  'qty per': 'qty',
  'reference designator': 'reference_designators',
  'reference': 'reference_designators',
  'designator': 'reference_designators',
  'refdes': 'reference_designators',
  'ref des': 'reference_designators',
  'ref': 'reference_designators',
  'footprint': 'package',
  'package': 'package',
  '封装': 'package',
  'value': 'value',
  '数值': 'value',
  '型号': 'part_number',
  'part number 型号': 'part_number',
  '描述': 'description',
  '数量': 'qty',
  '位号': 'reference_designators',
  '位置': 'reference_designators',
};

function normalizeHeader(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .replace(/[^a-z0-9一-龥 ]/g, '')
    .trim();
}

function mapHeaders(headers: string[]): Map<string, string> {
  const mapping = new Map<string, string>();

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (COLUMN_MAP[normalized]) {
      mapping.set(header, COLUMN_MAP[normalized]);
    }
  }

  return mapping;
}

export function parseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { items: [], errors: [{ row: 0, message: 'No sheets found in workbook' }] };
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

  const result: ParseResult = { items: [], errors: [] };

  if (jsonData.length === 0) {
    result.errors.push({ row: 0, message: 'Empty worksheet' });
    return result;
  }

  const headers = Object.keys(jsonData[0]);
  const columnMapping = mapHeaders(headers);
  const mappedColumns = new Set(columnMapping.values());

  if (!mappedColumns.has('part_number') && !mappedColumns.has('qty')) {
    // Try to auto-detect from first row
    result.errors.push({
      row: 0,
      message: `Could not identify required columns. Found: ${headers.join(', ')}. Expected: Part Number, Qty, Description`,
    });
    return result;
  }

  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i];
    const partNumberKey = [...columnMapping.entries()].find(([, v]) => v === 'part_number')?.[0];
    const qtyKey = [...columnMapping.entries()].find(([, v]) => v === 'qty')?.[0];
    const descKey = [...columnMapping.entries()].find(([, v]) => v === 'description')?.[0];
    const refKey = [...columnMapping.entries()].find(([, v]) => v === 'reference_designators')?.[0];

    const partNumber = partNumberKey ? String(row[partNumberKey]).trim() : '';
    const qtyRaw = qtyKey ? row[qtyKey] : 0;
    const description = descKey ? String(row[descKey]).trim() : '';
    const refDes = refKey ? String(row[refKey]).trim() : '';
    const valueKey = [...columnMapping.entries()].find(([, v]) => v === 'value')?.[0];
    const packageKey = [...columnMapping.entries()].find(([, v]) => v === 'package')?.[0];
    const value = valueKey ? String(row[valueKey]).trim() : '';
    const pkg = packageKey ? String(row[packageKey]).trim() : '';

    if (!partNumber) {
      result.errors.push({ row: i + 2, message: 'Missing part number' });
      continue;
    }

    const qty = parseInt(String(qtyRaw), 10);
    if (isNaN(qty) || qty <= 0) {
      result.errors.push({ row: i + 2, message: `Invalid quantity: "${qtyRaw}" for part "${partNumber}"` });
      continue;
    }

    result.items.push({
      part_number: partNumber,
      description,
      qty,
      reference_designators: refDes,
      value,
      package: pkg,
    });
  }

  return result;
}
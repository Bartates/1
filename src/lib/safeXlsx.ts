import ExcelJS from 'exceljs';

const DEFAULT_ALLOWED_EXTENSIONS = ['.xlsx', '.xlsm', '.csv'] as const;
const DANGEROUS_HEADER_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export const SAFE_XLSX_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxSheets: 8,
  maxRows: 5000,
  maxCols: 120,
};

export interface SafeWorkbookData {
  sheetNames: string[];
  getSheetRows: (sheetName: string, options?: { defval?: unknown; blankrows?: boolean }) => unknown[][];
}

function fileExt(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : '';
}

function fail(message: string): never {
  throw new Error(message);
}

export function assertSafeSpreadsheetFile(file: File, allowedExtensions: readonly string[] = DEFAULT_ALLOWED_EXTENSIONS): void {
  const ext = fileExt(file.name);
  if (!allowedExtensions.includes(ext)) {
    fail(`Desteklenmeyen dosya tipi: ${ext || 'bilinmiyor'}`);
  }
  if (file.size > SAFE_XLSX_LIMITS.maxBytes) {
    fail(`Dosya cok buyuk. En fazla ${Math.round(SAFE_XLSX_LIMITS.maxBytes / (1024 * 1024))} MB desteklenir.`);
  }
}

function normalizeCellValue(value: ExcelJS.CellValue | undefined | null): unknown {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => normalizeCellValue(item)).join(' ');

  if (typeof value === 'object') {
    if ('result' in value && value.result != null) return normalizeCellValue(value.result as ExcelJS.CellValue);
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink;
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map(part => part.text).join('');
    if ('formula' in value && typeof value.formula === 'string') return value.formula;
  }

  return String(value);
}

function validateWorksheet(worksheet: ExcelJS.Worksheet, sourceName?: string) {
  const rowCount = Math.max(worksheet.actualRowCount || 0, worksheet.rowCount || 0);
  const colCount = Math.max(worksheet.actualColumnCount || 0, worksheet.columnCount || 0);
  if (rowCount > SAFE_XLSX_LIMITS.maxRows) {
    fail(`${sourceName || 'Dosya'} icindeki ${worksheet.name} sayfasi cok buyuk. En fazla ${SAFE_XLSX_LIMITS.maxRows} satir desteklenir.`);
  }
  if (colCount > SAFE_XLSX_LIMITS.maxCols) {
    fail(`${sourceName || 'Dosya'} icindeki ${worksheet.name} sayfasi cok genis. En fazla ${SAFE_XLSX_LIMITS.maxCols} sutun desteklenir.`);
  }
}

function extractSheetRows(worksheet: ExcelJS.Worksheet, options: { defval?: unknown; blankrows?: boolean } = {}): unknown[][] {
  validateWorksheet(worksheet);
  const rows: unknown[][] = [];

  worksheet.eachRow({ includeEmpty: options.blankrows ?? false }, (row) => {
    const maxCells = Math.min(Math.max(row.actualCellCount || 0, row.cellCount || 0), SAFE_XLSX_LIMITS.maxCols);
    const values = Array.from({ length: maxCells }, (_, index) => {
      const normalized = normalizeCellValue(row.getCell(index + 1).value);
      return normalized ?? (options.defval ?? '');
    });

    const hasContent = values.some(value => value !== null && value !== undefined && String(value).trim() !== '');
    if (!hasContent && !(options.blankrows ?? false)) return;
    rows.push(values);
  });

  if (rows.length > SAFE_XLSX_LIMITS.maxRows) {
    fail(`Sayfa veri limiti asildi. En fazla ${SAFE_XLSX_LIMITS.maxRows} satir desteklenir.`);
  }

  return rows;
}

export async function readSafeWorkbook(input: ArrayBuffer, options: { sourceName?: string }): Promise<SafeWorkbookData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input);
  if (workbook.worksheets.length === 0) {
    fail('Dosyada okunabilir sayfa bulunamadi.');
  }
  if (workbook.worksheets.length > SAFE_XLSX_LIMITS.maxSheets) {
    fail(`Cok fazla sayfa var. En fazla ${SAFE_XLSX_LIMITS.maxSheets} sayfa desteklenir.`);
  }
  workbook.worksheets.forEach(worksheet => validateWorksheet(worksheet, options.sourceName));

  return {
    sheetNames: workbook.worksheets.map(worksheet => worksheet.name),
    getSheetRows: (sheetName, rowOptions = {}) => {
      const worksheet = workbook.getWorksheet(sheetName);
      return worksheet ? extractSheetRows(worksheet, rowOptions) : [];
    },
  };
}

export function makeSafeHeaders(headerRow: Array<string | number | boolean | null | undefined>): string[] {
  const seen = new Map<string, number>();

  return headerRow.map((header, index) => {
    const raw = header != null ? String(header).trim() : `Sutun ${index + 1}`;
    const normalized = raw || `Sutun ${index + 1}`;
    const safeBase = DANGEROUS_HEADER_KEYS.has(normalized) ? `Alan ${index + 1}` : normalized;
    const dupCount = seen.get(safeBase) ?? 0;
    seen.set(safeBase, dupCount + 1);
    return dupCount === 0 ? safeBase : `${safeBase}_${dupCount + 1}`;
  });
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).find(line => line.trim().length > 0) || '';
  const candidates = [',', ';', '\t'];
  return candidates.sort((left, right) => sample.split(right).length - sample.split(left).length)[0] || ',';
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells;
}

export function parseCsvText(text: string): unknown[][] {
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0)
    .map(line => parseDelimitedLine(line, delimiter));

  if (rows.length > SAFE_XLSX_LIMITS.maxRows) {
    fail(`CSV veri limiti asildi. En fazla ${SAFE_XLSX_LIMITS.maxRows} satir desteklenir.`);
  }

  rows.forEach((row) => {
    if (row.length > SAFE_XLSX_LIMITS.maxCols) {
      fail(`CSV sutun limiti asildi. En fazla ${SAFE_XLSX_LIMITS.maxCols} sutun desteklenir.`);
    }
  });

  return rows;
}

function applyColumnWidths(worksheet: ExcelJS.Worksheet, widths?: number[]) {
  widths?.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
}

function triggerDownload(buffer: BlobPart, fileName: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadObjectSheetsAsXlsx(
  sheets: Array<{ name: string; rows: Record<string, unknown>[]; widths?: number[] }>,
  fileName: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.name);
    const headers = sheet.rows.length > 0 ? Object.keys(sheet.rows[0]) : [];
    if (headers.length > 0) {
      worksheet.addRow(headers);
      sheet.rows.forEach((row) => worksheet.addRow(headers.map(header => row[header] ?? '')));
    } else {
      worksheet.addRow([]);
    }
    applyColumnWidths(worksheet, sheet.widths);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, fileName);
}

export async function downloadAoASheetsAsXlsx(
  sheets: Array<{ name: string; rows: unknown[][]; widths?: number[] }>,
  fileName: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.name);
    sheet.rows.forEach((row) => worksheet.addRow(row));
    applyColumnWidths(worksheet, sheet.widths);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, fileName);
}
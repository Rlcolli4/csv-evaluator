import { parseFile } from './parser.js';

// Papa.parse(File) uses file.stream() which is not available in Node's File.
// Mock so that "import Papa from 'papaparse'" gets an object with parse(). We use the real
// Papa to parse strings; for File we read as text then parse.
jest.mock('papaparse', () => {
  const actual = jest.requireActual('papaparse') as { parse: (input: unknown, opts: unknown) => void };
  const realParse = actual.parse;

  function parse(input: File | string, opts: Record<string, unknown>): void {
    if (input instanceof File) {
      input.text().then((text) => {
        realParse(text, { ...opts, skipEmptyLines: true });
      });
    } else {
      realParse(input, opts);
    }
  }

  // Parser uses "import Papa from 'papaparse'" so it expects default export with .parse
  const mockPapa = { parse };
  return {
    __esModule: true,
    default: mockPapa,
    parse, // also as named for any other consumers
  };
});

// FileReader is not available in Node. Polyfill so parseExcel can read File as ArrayBuffer.
class FileReaderMock {
  onload: ((e: { target: FileReaderMock }) => void) | null = null;
  onerror: (() => void) | null = null;
  result: ArrayBuffer | null = null;

  readAsArrayBuffer(blob: Blob | File): void {
    (blob as File).arrayBuffer().then((ab) => {
      this.result = ab;
      if (this.onload) this.onload({ target: this });
    });
  }
}

beforeAll(() => {
  (global as unknown as { FileReader: typeof FileReader }).FileReader = FileReaderMock as unknown as typeof FileReader;
});

describe('parseFile', () => {
  it('parses CSV file into 2D array', async () => {
    const csv = 'Name,Email,Age\nAlice,alice@example.com,30\nBob,bob@example.com,25';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const result = await parseFile(file);
    expect(result).toEqual([
      ['Name', 'Email', 'Age'],
      ['Alice', 'alice@example.com', '30'],
      ['Bob', 'bob@example.com', '25'],
    ]);
  });

  it('parses CSV with different extension case', async () => {
    const csv = 'A,B\n1,2';
    const file = new File([csv], 'data.CSV', { type: 'text/csv' });
    const result = await parseFile(file);
    expect(result).toEqual([['A', 'B'], ['1', '2']]);
  });

  it('throws for unsupported file type', async () => {
    const file = new File(['content'], 'file.txt', { type: 'text/plain' });
    await expect(parseFile(file)).rejects.toThrow('Unsupported file type: txt');
  });

  it('throws for unknown extension', async () => {
    const file = new File(['content'], 'file.xyz', { type: 'application/octet-stream' });
    await expect(parseFile(file)).rejects.toThrow('Unsupported file type: xyz');
  });

  it('parses CSV with single row (headers only)', async () => {
    const csv = 'Col1,Col2';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const result = await parseFile(file);
    expect(result).toEqual([['Col1', 'Col2']]);
  });

  it('skips empty lines in CSV', async () => {
    const csv = 'A,B\n1,2\n\n3,4';
    const file = new File([csv], 'test.csv', { type: 'text/csv' });
    const result = await parseFile(file);
    expect(result).toEqual([['A', 'B'], ['1', '2'], ['3', '4']]);
  });

  it('parses xlsx extension (Excel) when FileReader and XLSX work', async () => {
    // Minimal XLSX: we need a real binary or we mock. Use a tiny valid xlsx buffer.
    // xlsx library can create workbook from array; read back. For test we mock parseExcel
    // or use a pre-built minimal base64 xlsx. Simplest: create minimal sheet with xlsx write.
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['H1', 'H2'], ['a', 'b']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const result = await parseFile(file);
    expect(result).toEqual([['H1', 'H2'], ['a', 'b']]);
  });

  it('parses xls extension (Excel)', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['X', 'Y'], ['1', '2']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xls' });
    const file = new File([buf], 'test.xls', {
      type: 'application/vnd.ms-excel',
    });
    const result = await parseFile(file);
    expect(result).toEqual([['X', 'Y'], ['1', '2']]);
  });

  it('parses xlsm extension', async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([['A'], ['B']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([buf], 'book.xlsm', {
      type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
    });
    const result = await parseFile(file);
    expect(result).toEqual([['A'], ['B']]);
  });
});

import type { HeaderConfig } from './types.js';
import {
  validateHeaders,
  validateDataRows,
  validateColumnSchemas,
  validateEncoding,
} from './validator.js';

describe('validateHeaders', () => {
  it('returns null when headers match expected in strict order', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['Name', 'Email', 'Age'],
      strictOrder: true,
    };
    expect(validateHeaders(['Name', 'Email', 'Age'], config)).toBeNull();
  });

  it('returns failure when a header is missing', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['Name', 'Email', 'Age'],
      strictOrder: true,
    };
    const result = validateHeaders(['Name', 'Age'], config);
    expect(result).not.toBeNull();
    expect(result!.reason).toContain('Missing required headers');
    expect(result!.reason).toContain('Email');
  });

  it('returns failure when order is wrong in strict mode', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['Name', 'Email', 'Age'],
      strictOrder: true,
    };
    const result = validateHeaders(['Name', 'Age', 'Email'], config);
    expect(result).not.toBeNull();
    expect(result!.column).toBe('Email');
    expect(result!.reason).toMatch(/Expected header.*position/);
  });

  it('returns failure when header count differs in strict mode', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['Name', 'Email'],
      strictOrder: true,
    };
    const result = validateHeaders(['Name', 'Email', 'Extra'], config);
    expect(result).not.toBeNull();
    expect(result!.reason).toContain('Expected 2 headers, found 3');
  });

  it('allows any order when strictOrder is false', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['Name', 'Email', 'Age'],
      strictOrder: false,
    };
    expect(validateHeaders(['Age', 'Name', 'Email'], config)).toBeNull();
  });

  it('is case-insensitive when caseInsensitive is true', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['name', 'email'],
      strictOrder: false,
      caseInsensitive: true,
    };
    expect(validateHeaders(['NAME', 'Email'], config)).toBeNull();
  });

  it('is case-sensitive by default', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['Name', 'Email'],
      strictOrder: false,
    };
    const result = validateHeaders(['name', 'email'], config);
    expect(result).not.toBeNull();
    expect(result!.reason).toContain('Missing required headers');
  });

  it('trims whitespace in headers', () => {
    const config: HeaderConfig = {
      expectedHeaders: ['Name', 'Email'],
      strictOrder: true,
    };
    expect(validateHeaders(['  Name  ', '  Email  '], config)).toBeNull();
  });
});

describe('validateDataRows', () => {
  const headers = ['Name', 'Email'];
  const data = [
    headers,
    ['Alice', 'alice@example.com'],
    ['Bob', 'bob@example.com'],
  ];

  it('returns empty array when validateSqlInjection is false', () => {
    expect(validateDataRows(data, headers, false)).toEqual([]);
  });

  it('returns empty array when no dangerous patterns', () => {
    expect(validateDataRows(data, headers, true)).toEqual([]);
  });

  it('detects statement terminator (semicolon)', () => {
    const badData = [headers, ['Alice; DROP TABLE users', 'a@b.com']];
    const failures = validateDataRows(badData, headers, true);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].reason).toContain('Statement terminator');
    expect(failures[0].line).toBe(2);
  });

  it('detects SQL comment pattern', () => {
    const badData = [headers, ['Alice', 'alice@x.com--comment']];
    const failures = validateDataRows(badData, headers, true);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].reason).toContain('SQL comment');
  });

  it('detects UNION SELECT pattern', () => {
    const badData = [headers, ['x', "y' UNION SELECT password"]];
    const failures = validateDataRows(badData, headers, true);
    expect(failures.length).toBeGreaterThan(0);
  });

  it('skips empty rows', () => {
    const withEmpty = [headers, [], ['Alice', 'a@b.com']];
    expect(validateDataRows(withEmpty, headers, true)).toEqual([]);
  });

  it('skips empty cells', () => {
    const dataWithEmptyCell = [headers, ['Alice', '']];
    expect(validateDataRows(dataWithEmptyCell, headers, true)).toEqual([]);
  });
});

describe('validateColumnSchemas', () => {
  const headers = ['Name', 'Age', 'Active'];

  it('returns empty array when no columnSchemas', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: {},
    };
    const data = [headers, ['Alice', '30', 'true']];
    expect(validateColumnSchemas(data, headers, config)).toEqual([]);
  });

  it('returns empty when columnSchemas not in config', () => {
    const config: HeaderConfig = { expectedHeaders: headers };
    const data = [headers, ['Alice', '30', 'true']];
    expect(validateColumnSchemas(data, headers, config)).toEqual([]);
  });

  it('validates number type', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: { Age: { type: 'number' } },
    };
    const data = [headers, ['Alice', '30', 'true']];
    expect(validateColumnSchemas(data, headers, config)).toEqual([]);
  });

  it('fails when number column has non-numeric value', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: { Age: { type: 'number' } },
    };
    const data = [headers, ['Alice', 'not-a-number', 'true']];
    const failures = validateColumnSchemas(data, headers, config);
    expect(failures.length).toBe(1);
    expect(failures[0].column).toBe('Age');
    expect(failures[0].reason).toContain('expects a number');
  });

  it('validates boolean type (true, false, T, F)', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: { Active: { type: 'boolean' } },
    };
    const data = [headers, ['Alice', '30', 'true'], ['Bob', '25', 'F']];
    expect(validateColumnSchemas(data, headers, config)).toEqual([]);
  });

  it('fails when boolean column has invalid value', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: { Active: { type: 'boolean' } },
    };
    const data = [headers, ['Alice', '30', 'yes']];
    const failures = validateColumnSchemas(data, headers, config);
    expect(failures.length).toBe(1);
    expect(failures[0].reason).toContain('expects a boolean');
  });

  it('allows null/empty when allowNull is true', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: { Name: { type: 'string', allowNull: true } },
    };
    const data = [headers, ['', '30', 'true']];
    expect(validateColumnSchemas(data, headers, config)).toEqual([]);
  });

  it('fails when allowNull is false and value is empty', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: { Name: { type: 'string', allowNull: false } },
    };
    const data = [headers, ['', '30', 'true']];
    const failures = validateColumnSchemas(data, headers, config);
    expect(failures.length).toBe(1);
    expect(failures[0].reason).toContain('does not allow null or empty');
  });

  it('accepts quoted number for number type', () => {
    const config: HeaderConfig = {
      expectedHeaders: headers,
      columnSchemas: { Age: { type: 'number' } },
    };
    const data = [headers, ['Alice', '"42"', 'true']];
    expect(validateColumnSchemas(data, headers, config)).toEqual([]);
  });
});

describe('validateEncoding', () => {
  const headers = ['Name', 'Email'];

  it('returns empty when no encoding violations (ASCII)', () => {
    const data = [headers, ['Alice', 'alice@example.com']];
    expect(validateEncoding(data, headers, ['UTF8', 'ASCII'])).toEqual([]);
  });

  it('returns empty when allowedEncodings is empty', () => {
    const data = [headers, ['Café', 'test@test.com']];
    expect(validateEncoding(data, headers, [])).toEqual([]);
  });

  it('reports character not in UTF8/ASCII range', () => {
    const data = [headers, ['Café', 'test@test.com']]; // é is U+00E9, outside ASCII
    const failures = validateEncoding(data, headers, ['UTF8']);
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].reason).toMatch(/not allowed in specified encodings/);
  });

  it('allows LATIN1 range when LATIN1 is allowed', () => {
    const data = [headers, ['Café', 'naïve']]; // within 0-255
    const failures = validateEncoding(data, headers, ['LATIN1']);
    expect(failures).toEqual([]);
  });
});

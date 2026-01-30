import {
  ColumnConstraints,
  EncodingType,
  HeaderConfig,
  ValidationFailure,
} from './types.js';

/**
 * Characters and patterns that could potentially break SQL databases or cause injection attacks
 * Note: Some patterns like quotes might be legitimate in data, but are flagged as they require
 * proper escaping in SQL statements
 */
const SQL_DANGEROUS_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /;/, description: 'Statement terminator' },
  { pattern: /--/, description: 'SQL comment' },
  { pattern: /\/\*/, description: 'Multi-line comment start' },
  { pattern: /\*\//, description: 'Multi-line comment end' },
  { pattern: /';/, description: 'Quote followed by statement terminator (potential injection)' },
  { pattern: /';\s*(drop|delete|update|insert|select)/i, description: 'SQL injection pattern' },
  { pattern: /';\s*exec/i, description: 'SQL injection with exec' },
  { pattern: /';\s*union/i, description: 'SQL injection with union' },
  { pattern: /\x00/, description: 'Null byte' },
  { pattern: /\x1a/, description: 'Ctrl+Z character' },
  { pattern: /\x08/, description: 'Backspace character' },
  { pattern: /xp_/i, description: 'Extended stored procedure' },
  { pattern: /sp_/i, description: 'System stored procedure' },
  { pattern: /exec\s*\(/i, description: 'EXEC( statement' },
  { pattern: /execute\s*\(/i, description: 'EXECUTE( statement' },
  { pattern: /select\s+.*\s+from/i, description: 'SELECT ... FROM statement' },
  { pattern: /insert\s+into/i, description: 'INSERT INTO statement' },
  { pattern: /update\s+.*\s+set/i, description: 'UPDATE ... SET statement' },
  { pattern: /delete\s+from/i, description: 'DELETE FROM statement' },
  { pattern: /drop\s+(table|database|schema)/i, description: 'DROP TABLE/DATABASE statement' },
  { pattern: /union\s+select/i, description: 'UNION SELECT statement' },
  { pattern: /or\s+1\s*=\s*1/i, description: 'OR 1=1 injection pattern' },
  { pattern: /'\s*or\s*'/i, description: 'Quote OR quote injection pattern' },
];

/**
 * Validates headers against the configuration
 */
export function validateHeaders(
  headers: string[],
  config: HeaderConfig
): ValidationFailure | null {
  const expectedHeaders = config.expectedHeaders;
  const strictOrder = config.strictOrder ?? true;
  const caseInsensitive = config.caseInsensitive ?? false;

  // Normalize headers if case insensitive
  const normalize = (str: string) => caseInsensitive ? str.toLowerCase().trim() : str.trim();
  const normalizedHeaders = headers.map(normalize);
  const normalizedExpected = expectedHeaders.map(normalize);

  // Check if all expected headers are present
  const missingHeaders: string[] = [];
  normalizedExpected.forEach((expected, index) => {
    if (!normalizedHeaders.includes(expected)) {
      missingHeaders.push(expectedHeaders[index]);
    }
  });

  if (missingHeaders.length > 0) {
    return {
      column: 'headers',
      line: 1,
      reason: `Missing required headers: ${missingHeaders.join(', ')}`,
    };
  }

  // Check for unexpected headers
  if (strictOrder) {
    // Check exact order
    if (normalizedHeaders.length !== normalizedExpected.length) {
      return {
        column: 'headers',
        line: 1,
        reason: `Expected ${normalizedExpected.length} headers, found ${normalizedHeaders.length}`,
      };
    }

    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (normalizedHeaders[i] !== normalizedExpected[i]) {
        return {
          column: expectedHeaders[i] || `column ${i + 1}`,
          line: 1,
          reason: `Expected header "${expectedHeaders[i]}" at position ${i + 1}, found "${headers[i]}"`,
        };
      }
    }
  } else {
    // Just check presence, order doesn't matter
    // This is already checked above, so no additional validation needed
  }

  return null;
}

/** Boolean values allowed in CSV (case-insensitive): T, F, true, false */
const BOOLEAN_VALUES = new Set(['t', 'f', 'true', 'false']);

/** Number pattern: optional minus at start, digits and optional decimal (e.g. -3.14, .5, 42) */
const NUMBER_PATTERN = /^-?(\d+(\.\d*)?|\d*\.\d+)$/;

/**
 * Strips one layer of surrounding single or double quotes for type evaluation.
 * Used so quoted values like "123" are evaluated as the inner value only.
 */
function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/**
 * Returns columnSchemas filtered to only keys that exist in expected headers.
 * Keys not in expectedHeaders are dropped so they don't break validation downstream.
 */
function getFilteredColumnSchemas(config: HeaderConfig): Record<string, ColumnConstraints> {
  const columnSchemas = config.columnSchemas;
  if (!columnSchemas || Object.keys(columnSchemas).length === 0) {
    return {};
  }

  const caseInsensitive = config.caseInsensitive ?? false;
  const normalize = (str: string) =>
    caseInsensitive ? str.toLowerCase().trim() : str.trim();
  const normalizedExpected = new Set(
    config.expectedHeaders.map((h) => normalize(h))
  );

  const filtered: Record<string, ColumnConstraints> = {};
  for (const key of Object.keys(columnSchemas)) {
    const normalizedKey = normalize(key);
    if (normalizedExpected.has(normalizedKey)) {
      const canonicalKey = config.expectedHeaders.find((h) => normalize(h) === normalizedKey) ?? key;
      filtered[canonicalKey] = columnSchemas[key];
    }
  }
  return filtered;
}

/**
 * Validates a single cell value against column constraints.
 * Value may be surrounded by quotes; we evaluate the inner value for type.
 * rawValue is coerced to string so substring is safe (e.g. when value is a number).
 */
function validateCellForSchema(
  rawValue: unknown,
  constraints: ColumnConstraints,
  columnName: string,
  lineNumber: number
): ValidationFailure | null {
  const rawStr = typeof rawValue === 'string' ? rawValue : String(rawValue);

  const type = constraints.type ?? 'string';
  const allowNull = constraints.allowNull ?? true;

  const trimmed = rawStr.trim();
  const isEmpty = trimmed === '' || trimmed == null;

  if (isEmpty) {
    if (!allowNull) {
      return {
        column: columnName,
        line: lineNumber,
        reason: `Column "${columnName}" does not allow null or empty values`,
      };
    }
    return null;
  }

  const valueToCheck = stripSurroundingQuotes(trimmed);

  if (type === 'string') {
    return null;
  }

  if (type === 'number') {
    if (!NUMBER_PATTERN.test(valueToCheck)) {
      const preview = rawStr.length > 50 ? `${rawStr.substring(0, 50)}...` : rawStr;
      return {
        column: columnName,
        line: lineNumber,
        reason: `Column "${columnName}" expects a number; got: "${preview}"`,
      };
    }
    return null;
  }

  if (type === 'boolean') {
    const normalized = valueToCheck.toLowerCase();
    if (!BOOLEAN_VALUES.has(normalized)) {
      const preview = rawStr.length > 50 ? `${rawStr.substring(0, 50)}...` : rawStr;
      return {
        column: columnName,
        line: lineNumber,
        reason: `Column "${columnName}" expects a boolean (T, F, true, false); got: "${preview}"`,
      };
    }
    return null;
  }

  return null;
}

/**
 * Validates data rows against column schemas (type and nullability).
 * columnSchemas keys not in expectedHeaders are ignored (filtered out).
 */
export function validateColumnSchemas(
  data: string[][],
  headers: string[],
  config: HeaderConfig
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];
  const columnSchemas = getFilteredColumnSchemas(config);
  if (Object.keys(columnSchemas).length === 0) {
    return failures;
  }

  const caseInsensitive = config.caseInsensitive ?? false;
  const normalize = (str: string) =>
    caseInsensitive ? str.toLowerCase().trim() : str.trim();

  const normalizedHeaders = headers.map(normalize);
  const expectedNormalized = config.expectedHeaders.map(normalize);

  const colIndexToConstraints: Array<{ name: string; constraints: ColumnConstraints } | null> = headers.map(
    (_header, colIndex) => {
      const normalized = normalizedHeaders[colIndex];
      const expectedIndex = expectedNormalized.indexOf(normalized);
      if (expectedIndex === -1) return null;
      const expectedKey = config.expectedHeaders[expectedIndex];
      const constraints = columnSchemas[expectedKey];
      if (!constraints) return null;
      const columnName = headers[colIndex];
      return { name: columnName, constraints };
    }
  );

  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    if (!row || row.length === 0) continue;

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const entry = colIndexToConstraints[colIndex];
      if (!entry) continue;

      const cellValue = String(row[colIndex] ?? '');
      const failure = validateCellForSchema(
        cellValue,
        entry.constraints,
        entry.name,
        rowIndex + 1
      );
      if (failure) failures.push(failure);
    }
  }

  return failures;
}

/**
 * Validates data rows for SQL injection risks
 */
export function validateDataRows(
  data: string[][],
  headers: string[],
  validateSqlInjection: boolean = true
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (!validateSqlInjection) {
    return failures;
  }

  // Start from row 2 (index 1) since row 1 (index 0) is headers
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];

    // Skip empty rows
    if (!row || row.length === 0 || row.every(cell => cell === '' || cell == null)) {
      continue;
    }

    // Check each cell in the row
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cellValue = String(row[colIndex] ?? '').trim();

      // Skip empty cells
      if (cellValue === '') {
        continue;
      }

      // Check for SQL dangerous patterns
      for (const { pattern, description } of SQL_DANGEROUS_PATTERNS) {
        if (pattern.test(cellValue)) {
          const columnName = headers[colIndex] || `Column ${colIndex + 1}`;
          const preview = cellValue.substring(0, 50);
          failures.push({
            column: columnName,
            line: rowIndex + 1, // 1-based line number
            reason: `Contains potentially dangerous SQL pattern (${description}): "${preview}${cellValue.length > 50 ? '...' : ''}"`,
          });
          break; // Only report one issue per cell
        }
      }
    }
  }

  return failures;
}

/**
 * Character encoding ranges
 * Note: UTF8 here means UTF-8 encoding format but restricted to ASCII range (0-127)
 * to match common database constraints. For extended characters, use LATIN1 or other encodings.
 */
const ENCODING_RANGES: Record<EncodingType, { min: number; max: number }> = {
  ASCII: { min: 0x00, max: 0x7F },           // 0-127
  LATIN1: { min: 0x00, max: 0xFF },          // 0-255 (ISO-8859-1)
  UTF8: { min: 0x00, max: 0x7F },           // ASCII only (0-127) - UTF-8 format but restricted to ASCII
  UTF16: { min: 0x00, max: 0x7F },           // ASCII only (0-127) - UTF-16 format but restricted to ASCII
  WINDOWS1252: { min: 0x00, max: 0xFF },     // 0-255 (Windows-1252)
};

/**
 * Checks if a character code is valid for the given encoding
 */
function isValidForEncoding(charCode: number, encoding: EncodingType): boolean {
  const range = ENCODING_RANGES[encoding];
  return charCode >= range.min && charCode <= range.max;
}

/**
 * Validates data rows for character encoding compliance
 */
export function validateEncoding(
  data: string[][],
  headers: string[],
  allowedEncodings: EncodingType[] = ['UTF8']
): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (allowedEncodings.length === 0) {
    return failures; // No encoding restrictions
  }

  // Start from row 2 (index 1) since row 1 (index 0) is headers
  for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];

    // Skip empty rows
    if (!row || row.length === 0 || row.every(cell => cell === '' || cell == null)) {
      continue;
    }

    // Check each cell in the row
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const cellValue = String(row[colIndex] ?? '');

      // Skip empty cells
      if (cellValue === '') {
        continue;
      }

      // Check each character in the cell
      for (let charIndex = 0; charIndex < cellValue.length; charIndex++) {
        const charCode = cellValue.charCodeAt(charIndex);

        // Check if character is valid for at least one allowed encoding
        const isValid = allowedEncodings.some(encoding =>
          isValidForEncoding(charCode, encoding)
        );

        if (!isValid) {
          const columnName = headers[colIndex] || `Column ${colIndex + 1}`;
          const char = cellValue[charIndex];
          const charHex = `0x${charCode.toString(16).toUpperCase().padStart(4, '0')}`;
          failures.push({
            column: columnName,
            line: rowIndex + 1, // 1-based line number
            reason: `Contains character "${char}" (${charHex}) not allowed in specified encodings: ${allowedEncodings.join(', ')}`,
          });
          break; // Only report one invalid character per cell
        }
      }
    }
  }

  return failures;
}

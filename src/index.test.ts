import { validateFile } from './index.js';
import * as parser from './parser.js';
import * as validator from './validator.js';
import type { ValidationConfig } from './types.js';

jest.mock('./parser.js');
jest.mock('./validator.js');

const mockParseFile = parser.parseFile as jest.MockedFunction<typeof parser.parseFile>;
const mockValidateHeaders = validator.validateHeaders as jest.MockedFunction<typeof validator.validateHeaders>;
const mockValidateDataRows = validator.validateDataRows as jest.MockedFunction<typeof validator.validateDataRows>;
const mockValidateColumnSchemas = validator.validateColumnSchemas as jest.MockedFunction<typeof validator.validateColumnSchemas>;
const mockValidateEncoding = validator.validateEncoding as jest.MockedFunction<typeof validator.validateEncoding>;

function createFile(name: string, content: string): File {
  return new File([content], name, { type: 'text/csv' });
}

describe('validateFile', () => {
  const baseConfig: ValidationConfig = {
    headers: { expectedHeaders: ['Name', 'Email'] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success when all validations pass', async () => {
    const file = createFile('test.csv', 'Name,Email\nAlice,a@b.com');
    const data = [['Name', 'Email'], ['Alice', 'a@b.com']];
    mockParseFile.mockResolvedValue(data);
    mockValidateHeaders.mockReturnValue(null);
    mockValidateDataRows.mockReturnValue([]);
    mockValidateColumnSchemas.mockReturnValue([]);
    mockValidateEncoding.mockReturnValue([]);

    const result = await validateFile(file, baseConfig);

    expect(result.success).toBe(true);
    expect(result.message).toBe('File validation passed successfully');
    expect(mockParseFile).toHaveBeenCalledWith(file);
    expect(mockValidateHeaders).toHaveBeenCalledWith(data[0], baseConfig.headers);
    expect(mockValidateDataRows).toHaveBeenCalledWith(data, data[0], true);
  });

  it('returns failure when file is empty', async () => {
    mockParseFile.mockResolvedValue([]);

    const result = await validateFile(
      createFile('empty.csv', ''),
      baseConfig
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('File is empty');
    expect('failures' in result && result.failures[0].reason).toContain('no data');
    expect(mockValidateHeaders).not.toHaveBeenCalled();
  });

  it('returns failure when header validation fails', async () => {
    mockParseFile.mockResolvedValue([['Wrong', 'Headers']]);
    mockValidateHeaders.mockReturnValue({
      column: 'headers',
      line: 1,
      reason: 'Missing required headers: Name, Email',
    });

    const result = await validateFile(
      createFile('bad.csv', 'Wrong,Headers'),
      baseConfig
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe('Header validation failed');
    expect('failures' in result && result.failures).toHaveLength(1);
    expect(mockValidateDataRows).not.toHaveBeenCalled();
  });

  it('returns failure when SQL validation finds issues', async () => {
    const data = [['Name', 'Email'], ['Alice; DROP TABLE', 'a@b.com']];
    mockParseFile.mockResolvedValue(data);
    mockValidateHeaders.mockReturnValue(null);
    mockValidateDataRows.mockReturnValue([
      { column: 'Name', line: 2, reason: 'Contains potentially dangerous SQL pattern' },
    ]);
    mockValidateColumnSchemas.mockReturnValue([]);
    mockValidateEncoding.mockReturnValue([]);

    const result = await validateFile(
      createFile('bad.csv', 'Name,Email\nAlice; DROP TABLE,a@b.com'),
      baseConfig
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Validation failed');
    expect('failures' in result && result.failures.length).toBeGreaterThan(0);
  });

  it('respects validateSqlInjection: false', async () => {
    const data = [['Name', 'Email'], ['Alice', 'a@b.com']];
    mockParseFile.mockResolvedValue(data);
    mockValidateHeaders.mockReturnValue(null);
    mockValidateDataRows.mockReturnValue([]);
    mockValidateColumnSchemas.mockReturnValue([]);

    const config: ValidationConfig = {
      ...baseConfig,
      validateSqlInjection: false,
    };

    const result = await validateFile(createFile('test.csv', 'Name,Email\nAlice,a@b.com'), config);

    expect(result.success).toBe(true);
    expect(mockValidateDataRows).toHaveBeenCalledWith(data, data[0], false);
  });

  it('returns failure when column schema validation fails', async () => {
    const data = [['Name', 'Age'], ['Alice', 'not-a-number']];
    mockParseFile.mockResolvedValue(data);
    mockValidateHeaders.mockReturnValue(null);
    mockValidateDataRows.mockReturnValue([]);
    mockValidateColumnSchemas.mockReturnValue([
      { column: 'Age', line: 2, reason: 'Column "Age" expects a number' },
    ]);
    mockValidateEncoding.mockReturnValue([]);

    const config: ValidationConfig = {
      headers: {
        expectedHeaders: ['Name', 'Age'],
        columnSchemas: { Age: { type: 'number' } },
      },
    };

    const result = await validateFile(createFile('test.csv', 'Name,Age\nAlice,not-a-number'), config);

    expect(result.success).toBe(false);
    expect('failures' in result && result.failures.some(f => f.column === 'Age')).toBe(true);
  });

  it('calls validateEncoding when encoding config is provided', async () => {
    const data = [['Name', 'Email'], ['Alice', 'a@b.com']];
    mockParseFile.mockResolvedValue(data);
    mockValidateHeaders.mockReturnValue(null);
    mockValidateDataRows.mockReturnValue([]);
    mockValidateColumnSchemas.mockReturnValue([]);
    mockValidateEncoding.mockReturnValue([]);

    const config: ValidationConfig = {
      ...baseConfig,
      encoding: { allowedEncodings: ['UTF8'] },
    };

    await validateFile(createFile('test.csv', 'Name,Email\nAlice,a@b.com'), config);

    expect(mockValidateEncoding).toHaveBeenCalledWith(data, data[0], ['UTF8']);
  });

  it('returns failure when encoding validation fails', async () => {
    const data = [['Name', 'Email'], ['Café', 'a@b.com']];
    mockParseFile.mockResolvedValue(data);
    mockValidateHeaders.mockReturnValue(null);
    mockValidateDataRows.mockReturnValue([]);
    mockValidateColumnSchemas.mockReturnValue([]);
    mockValidateEncoding.mockReturnValue([
      { column: 'Name', line: 2, reason: 'Contains character not allowed' },
    ]);

    const config: ValidationConfig = {
      ...baseConfig,
      encoding: { allowedEncodings: ['UTF8'] },
    };

    const result = await validateFile(createFile('test.csv', 'Name,Email\nCafé,a@b.com'), config);

    expect(result.success).toBe(false);
    expect('failures' in result && result.failures.length).toBe(1);
  });

  it('returns failure when parseFile throws', async () => {
    mockParseFile.mockRejectedValue(new Error('Parse failed'));

    const result = await validateFile(
      createFile('bad.csv', 'x'),
      baseConfig
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Parse failed');
    expect('failures' in result && result.failures[0].reason).toBe('Parse failed');
  });

  it('handles non-Error throw', async () => {
    mockParseFile.mockRejectedValue('string error');

    const result = await validateFile(
      createFile('bad.csv', 'x'),
      baseConfig
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown error');
  });
});

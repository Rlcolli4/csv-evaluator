import { parseFile } from './parser.js';
import { ValidationConfig, ValidationResult } from './types.js';
import {
  validateColumnSchemas,
  validateDataRows,
  validateEncoding,
  validateHeaders,
} from './validator.js';

/**
 * Main function to validate a file against the provided configuration
 * 
 * @param file - File object from browser file input
 * @param config - Validation configuration
 * @returns Promise resolving to validation result
 * 
 * @example
 * ```typescript
 * const file = document.querySelector('input[type="file"]').files[0];
 * const config = {
 *   headers: {
 *     expectedHeaders: ['Name', 'Email', 'Age'],
 *     strictOrder: true,
 *     caseInsensitive: false
 *   },
 *   validateSqlInjection: true
 * };
 * 
 * const result = await validateFile(file, config);
 * if (result.success) {
 *   console.log('File is valid!');
 * } else {
 *   console.error('Validation failed:', result.failures);
 * }
 * ```
 */
export async function validateFile(
  file: File,
  config: ValidationConfig
): Promise<ValidationResult> {
  try {
    // Parse file into multidimensional array
    const data = await parseFile(file);

    if (data.length === 0) {
      return {
        success: false,
        message: 'File is empty',
        failures: [
          {
            column: 'file',
            line: 0,
            reason: 'File contains no data',
          },
        ],
      };
    }

    // Extract headers (first row)
    const headers = data[0];

    // Validate headers
    const headerFailure = validateHeaders(headers, config.headers);
    if (headerFailure) {
      return {
        success: false,
        message: 'Header validation failed',
        failures: [headerFailure],
      };
    }

    // Validate data rows for SQL injection risks
    const validateSql = config.validateSqlInjection ?? true;
    const sqlFailures = validateDataRows(data, headers, validateSql);

    // Validate column schemas (type and nullability) if configured
    const columnSchemaFailures =
      config.headers.columnSchemas && Object.keys(config.headers.columnSchemas).length > 0
        ? validateColumnSchemas(data, headers, config.headers)
        : [];

    // Validate character encoding
    const encodingFailures: typeof sqlFailures = [];
    if (config.encoding?.allowedEncodings && config.encoding.allowedEncodings.length > 0) {
      const encodingValidationFailures = validateEncoding(
        data,
        headers,
        config.encoding.allowedEncodings
      );
      encodingFailures.push(...encodingValidationFailures);
    }

    // Combine all failures
    const allFailures = [...sqlFailures, ...columnSchemaFailures, ...encodingFailures];

    if (allFailures.length > 0) {
      return {
        success: false,
        message: `Validation failed: ${allFailures.length} issue(s) found`,
        failures: allFailures,
      };
    }

    // All validations passed
    return {
      success: true,
      message: 'File validation passed successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      failures: [
        {
          column: 'file',
          line: 0,
          reason: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      ],
    };
  }
}

// Export types for use by consumers
export type {
  ColumnConstraints,
  ColumnSchemas,
  ColumnType,
  EncodingConfig,
  EncodingType,
  HeaderConfig,
  ValidationConfig,
  ValidationFailure,
  ValidationResult
} from './types.js';

// Export parser for advanced use cases
export { parseFile } from './parser.js';


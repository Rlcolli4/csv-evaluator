/**
 * Supported column data types for schema validation
 */
export type ColumnType = 'string' | 'number' | 'boolean';

/**
 * Constraints for a single column (keys must be from expected headers)
 * - type: defaults to "string"
 * - allowNull: whether null/empty values are allowed (default: true)
 */
export interface ColumnConstraints {
  /** Column data type (default: "string") */
  type?: ColumnType;
  /** Whether null or empty values are allowed (default: true) */
  allowNull?: boolean;
}

/**
 * Map of header names to column constraints. Keys must exist in expectedHeaders.
 * Only include entries for columns that need type or nullability rules.
 */
export type ColumnSchemas = Record<string, ColumnConstraints>;

/**
 * Configuration for header validation
 */
export interface HeaderConfig {
  /** Expected header names in order */
  expectedHeaders: string[];
  /** Whether header order must match exactly (default: true) */
  strictOrder?: boolean;
  /** Whether to perform case-insensitive comparison (default: false) */
  caseInsensitive?: boolean;
  /**
   * Optional column-level constraints. Keys must be from expectedHeaders.
   * Columns not listed use defaults: type "string", allowNull true.
   */
  columnSchemas?: ColumnSchemas;
}

/**
 * Character encoding types supported for validation
 */
export type EncodingType = 'UTF8' | 'LATIN1' | 'ASCII' | 'UTF16' | 'WINDOWS1252';

/**
 * Configuration for character encoding validation
 */
export interface EncodingConfig {
  /** List of allowed character encodings (default: ['UTF8']) */
  allowedEncodings?: EncodingType[];
}

/**
 * Configuration for file validation
 */
export interface ValidationConfig {
  /** Header validation configuration */
  headers: HeaderConfig;
  /** Whether to validate for SQL injection risks (default: true) */
  validateSqlInjection?: boolean;
  /** Character encoding validation configuration */
  encoding?: EncodingConfig;
}

/**
 * Detailed failure information
 */
export interface ValidationFailure {
  /** Column index (0-based) or column name */
  column: number | string;
  /** Row/line number (1-based, where 1 is the header row) */
  line: number;
  /** Reason for failure */
  reason: string;
}

/**
 * Validation result
 */
export type ValidationResult =
  | {
    success: true;
    message: string;
  }
  | {
    success: false;
    message: string;
    failures: ValidationFailure[];
  };

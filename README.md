# CSV Evaluator

A TypeScript library for validating Excel and CSV files before uploading to a server. The library checks file headers against defined criteria and validates data rows for potentially dangerous SQL characters that could cause database injection attacks.

## Features

- ✅ **Multi-format Support**: Handles CSV, XLSX, XLS, and XLSM files
- ✅ **Header Validation**: Validates file headers against expected criteria with configurable options
- ✅ **SQL Injection Protection**: Detects potentially dangerous characters and patterns in data cells
- ✅ **Detailed Error Reporting**: Returns specific column, line number, and reason for each validation failure
- ✅ **Browser Compatible**: Works with browser File objects from file input elements
- ✅ **TypeScript Support**: Fully typed for excellent developer experience

## Installation

```bash
npm install csv-evaluator
```

## Quick Start

### Browser Usage

```typescript
import { validateFile } from 'csv-evaluator';
import { ValidationConfig } from 'csv-evaluator';

// Define your validation configuration
const config: ValidationConfig = {
  headers: {
    expectedHeaders: ['Name', 'Email', 'Age'],
    strictOrder: false,        // Headers must be in exact order
    caseInsensitive: false,   // Case-sensitive header matching
  },
  validateSqlInjection: true, // Check for SQL injection risks
};

// Get file from file input
const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
const file = fileInput.files?.[0];

if (file) {
  const result = await validateFile(file, config);
  
  if (result.success) {
    console.log('✅', result.message);
    // File is valid, proceed with upload
  } else {
    console.error('❌', result.message);
    // Handle validation failures
    result.failures.forEach(failure => {
      console.error(`Column: ${failure.column}, Line: ${failure.line}`);
      console.error(`Reason: ${failure.reason}`);
    });
  }
}
```

### HTML Example

```html
<!DOCTYPE html>
<html>
<head>
  <script type="module">
    import { validateFile } from './node_modules/csv-evaluator/dist/index.js';
    
    const config = {
      headers: {
        expectedHeaders: ['Name', 'Email', 'Age'],
        strictOrder: true,
        caseInsensitive: false
      },
      validateSqlInjection: true
    };
    
    document.getElementById('fileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const result = await validateFile(file, config);
        document.getElementById('result').textContent = result.message;
      }
    });
  </script>
</head>
<body>
  <input type="file" id="fileInput" accept=".csv,.xlsx,.xls,.xlsm">
  <div id="result"></div>
</body>
</html>
```

## Configuration

### ValidationConfig

```typescript
interface ValidationConfig {
  headers: HeaderConfig;
  validateSqlInjection?: boolean; // Default: true
}
```

### HeaderConfig

```typescript
interface HeaderConfig {
  expectedHeaders: string[];      // Required: Array of expected header names
  strictOrder?: boolean;          // Default: true - Headers must match order exactly
  caseInsensitive?: boolean;      // Default: false - Case-sensitive matching
}
```

### Validation Result

The library returns a `ValidationResult` type:

```typescript
// Success case
{
  success: true;
  message: string;
}

// Failure case
{
  success: false;
  message: string;
  failures: ValidationFailure[];
}
```

### ValidationFailure

```typescript
interface ValidationFailure {
  column: number | string;  // Column index or name
  line: number;             // 1-based line number (1 = header row)
  reason: string;           // Description of the failure
}
```

## Examples

### Strict Header Order

```typescript
const config: ValidationConfig = {
  headers: {
    expectedHeaders: ['ID', 'Name', 'Email'],
    strictOrder: true,  // Headers must be in this exact order
  },
};
```

### Flexible Header Order

```typescript
const config: ValidationConfig = {
  headers: {
    expectedHeaders: ['ID', 'Name', 'Email'],
    strictOrder: false,  // Headers can be in any order, but all must be present
  },
};
```

### Case-Insensitive Headers

```typescript
const config: ValidationConfig = {
  headers: {
    expectedHeaders: ['name', 'email'],
    caseInsensitive: true,  // Will match "Name", "NAME", "name", etc.
  },
};
```

### Disable SQL Injection Check

```typescript
const config: ValidationConfig = {
  headers: {
    expectedHeaders: ['Name', 'Email'],
  },
  validateSqlInjection: false,  // Skip SQL injection validation
};
```

## SQL Injection Detection

The library detects the following potentially dangerous patterns:

- SQL statement terminators (`;`)
- SQL comments (`--`, `/* */`)
- SQL string delimiters (`'`, `"`)
- Escape characters (`\`)
- Null bytes and control characters
- Common SQL keywords (SELECT, INSERT, UPDATE, DELETE, DROP, UNION, etc.)
- Extended stored procedures (`xp_`, `sp_`)
- EXEC/EXECUTE statements

## Advanced Usage

### Parse File Without Validation

If you just need to parse a file into a multidimensional array:

```typescript
import { parseFile } from 'csv-evaluator';

const file = /* ... your file ... */;
const data = await parseFile(file);
// data is string[][], where data[0] is headers
```

## Building from Source

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run for testing
npm run serve
```

## Access the Test Index
Open a browser and go to http://localhost:3000

## Browser Compatibility

This library uses modern JavaScript features and requires:

- Browsers with ES2020 support
- File API support
- For Excel files: FileReader API support

For older browsers, you may need to use a bundler with polyfills.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

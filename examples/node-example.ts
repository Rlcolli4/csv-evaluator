/**
 * Example usage of csv-evaluator library
 * 
 * Note: This example shows how to use the library in a Node.js environment.
 * For browser usage, you would need to bundle the library or use a bundler.
 */

import { validateFile } from '../src/index';
import { ValidationConfig } from '../src/types';

// Example configuration
const config: ValidationConfig = {
  headers: {
    expectedHeaders: ['Name', 'Email', 'Age'],
    strictOrder: true,
    caseInsensitive: false,
  },
  validateSqlInjection: true,
};

// Example usage with a File object (in browser environment)
// In Node.js, you would need to create a File object from a buffer or use a different approach
async function example() {
  // This is a conceptual example - in a real browser scenario:
  
  // const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  // const file = fileInput.files?.[0];
  // 
  // if (!file) {
  //   console.error('No file selected');
  //   return;
  // }
  
  // const result = await validateFile(file, config);
  
  // if (result.success) {
  //   console.log('✅', result.message);
  // } else {
  //   console.error('❌', result.message);
  //   console.error('Failures:', result.failures);
  //   result.failures.forEach(failure => {
  //     console.error(`  - Column: ${failure.column}, Line: ${failure.line}, Reason: ${failure.reason}`);
  //   });
  // }
}

example().catch(console.error);

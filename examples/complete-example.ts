/**
 * Complete example demonstrating all features of csv-evaluator
 * 
 * This example shows how to use the library in a browser environment
 * with a file input element.
 */

import { validateFile, ValidationConfig } from '../src/index';

// Example 1: Strict header validation
async function exampleStrictHeaders() {
  const config: ValidationConfig = {
    headers: {
      expectedHeaders: ['Name', 'Email', 'Age'],
      strictOrder: true,        // Headers must be in exact order
      caseInsensitive: false,   // Case-sensitive matching
    },
    validateSqlInjection: true,
  };

  // In a browser environment:
  // const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  // const file = fileInput.files?.[0];
  // const result = await validateFile(file, config);

  console.log('Example 1: Strict header validation configured');
}

// Example 2: Flexible header order
async function exampleFlexibleHeaders() {
  const config: ValidationConfig = {
    headers: {
      expectedHeaders: ['ID', 'Email', 'Name'],
      strictOrder: false,  // Headers can be in any order
      caseInsensitive: true, // Case-insensitive matching
    },
    validateSqlInjection: true,
  };

  console.log('Example 2: Flexible header order configured');
}

// Example 3: Case-insensitive headers
async function exampleCaseInsensitive() {
  const config: ValidationConfig = {
    headers: {
      expectedHeaders: ['name', 'email'], // Will match "Name", "NAME", "name", etc.
      caseInsensitive: true,
    },
    validateSqlInjection: true,
  };

  console.log('Example 3: Case-insensitive headers configured');
}

// Example 4: Without SQL injection validation
async function exampleNoSqlValidation() {
  const config: ValidationConfig = {
    headers: {
      expectedHeaders: ['Name', 'Description'],
    },
    validateSqlInjection: false, // Skip SQL injection checks
  };

  console.log('Example 4: No SQL validation configured');
}

// Example 5: Complete browser integration
function setupBrowserIntegration() {
  const config: ValidationConfig = {
    headers: {
      expectedHeaders: ['Name', 'Email', 'Age'],
      strictOrder: true,
      caseInsensitive: false,
    },
    validateSqlInjection: true,
  };

  // This would be called when file input changes
  const handleFileSelect = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      console.error('No file selected');
      return;
    }

    console.log(`Validating file: ${file.name}`);

    const result = await validateFile(file, config);

    if (result.success) {
      console.log('✅', result.message);
      // File is valid, proceed with upload
      // uploadFile(file);
    } else {
      console.error('❌', result.message);
      console.error(`Found ${result.failures.length} validation error(s):`);
      
      result.failures.forEach((failure, index) => {
        console.error(`\n${index + 1}. Column: ${failure.column}`);
        console.error(`   Line: ${failure.line}`);
        console.error(`   Reason: ${failure.reason}`);
      });

      // Display errors to user
      // displayErrors(result.failures);
    }
  };

  // In a real application:
  // const fileInput = document.querySelector('#fileInput') as HTMLInputElement;
  // fileInput.addEventListener('change', handleFileSelect);

  console.log('Example 5: Browser integration example configured');
}

// Run examples
exampleStrictHeaders();
exampleFlexibleHeaders();
exampleCaseInsensitive();
exampleNoSqlValidation();
setupBrowserIntegration();

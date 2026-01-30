import * as XLSX from 'xlsx';
import Papa from 'papaparse';

/**
 * Parses a file (CSV or Excel) into a multidimensional string array
 * @param file - File object from browser file input
 * @returns Promise resolving to a 2D array where first row is headers
 */
export async function parseFile(file: File): Promise<string[][]> {
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.') + 1);

  if (extension === 'csv') {
    return parseCsv(file);
  } else if (['xlsx', 'xls', 'xlsm'].includes(extension)) {
    return parseExcel(file);
  } else {
    throw new Error(`Unsupported file type: ${extension}. Supported types: csv, xlsx, xls, xlsm`);
  }
}

/**
 * Parses a CSV file into a multidimensional string array
 */
async function parseCsv(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          return;
        }
        resolve(results.data as string[][]);
      },
      error: (error) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
      skipEmptyLines: true,
    });
  });
}

/**
 * Parses an Excel file into a multidimensional string array
 */
async function parseExcel(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error('Excel file contains no sheets'));
          return;
        }
        
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          blankrows: false,
        }) as string[][];
        
        resolve(jsonData);
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
}

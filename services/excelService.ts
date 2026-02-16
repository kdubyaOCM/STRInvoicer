import * as XLSX from 'xlsx';
import { RawSpreadsheetRow } from '../types';

/**
 * Read a spreadsheet file (Excel or CSV) and parse it to JSON
 * @param file - The file to read
 * @returns Array of rows as key-value objects
 * @throws Error if file cannot be read or parsed
 */
export const readSpreadsheet = async (file: File): Promise<RawSpreadsheetRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData as RawSpreadsheetRow[]);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

/**
 * Parse a classification map file that maps account names to expense categories
 * @param file - The classification map file
 * @returns Record mapping account names to category strings
 */
export const parseClassificationMap = async (file: File): Promise<Record<string, string>> => {
  const rawData = await readSpreadsheet(file);
  const map: Record<string, string> = {};

  rawData.forEach((row: RawSpreadsheetRow) => {
    // Look for columns like 'account_name' and 'default_category'
    // Be flexible with casing
    const keys = Object.keys(row);
    const accountKey = keys.find((k) => k.toLowerCase().includes('account'));
    const categoryKey = keys.find((k) => k.toLowerCase().includes('category'));

    if (accountKey && categoryKey) {
      const account = row[accountKey]?.toString().trim();
      const category = row[categoryKey]?.toString().trim().toUpperCase();
      if (account && category) {
        map[account] = category;
      }
    }
  });

  return map;
};

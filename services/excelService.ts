import * as XLSX from 'xlsx';

export const readSpreadsheet = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};

export const parseClassificationMap = async (file: File): Promise<Record<string, string>> => {
  const rawData = await readSpreadsheet(file);
  const map: Record<string, string> = {};
  
  rawData.forEach((row: any) => {
    // Look for columns like 'account_name' and 'default_category'
    // Be flexible with casing
    const keys = Object.keys(row);
    const accountKey = keys.find(k => k.toLowerCase().includes('account'));
    const categoryKey = keys.find(k => k.toLowerCase().includes('category'));
    
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
/**
 * CSV Sanitization Utility to prevent CSV / Formula Injection (CWE-1236).
 * Formulas starting with =, +, -, @, tab, or carriage return are escaped
 * with a leading single quote (') so spreadsheets treat them as plaintext.
 */

export function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  
  // Mitigate CSV Formula Injection (CWE-1236)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  
  const escaped = str.replace(/"/g, '""');
  if (escaped.search(/("|,|\n|\r)/) >= 0) {
    return `"${escaped}"`;
  }
  return escaped;
}

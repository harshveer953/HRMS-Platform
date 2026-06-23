/**
 * Converts an array of objects into a CSV formatted string.
 * @param {Array<Object>} data - Array of data rows
 * @param {Array<{label: string, key: string}>} columns - Headers mapping
 * @returns {string} - CSV formatted file contents
 */
function jsonToCsv(data, columns) {
  const headers = columns.map(col => `"${col.label.replace(/"/g, '""')}"`).join(',');
  
  const rows = data.map(item => {
    return columns.map(col => {
      // support dot notation for nested objects e.g., 'personal.name'
      let val = item;
      const parts = col.key.split('.');
      for (let part of parts) {
        val = val ? val[part] : '';
      }
      
      // format string
      const strVal = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
      return `"${strVal.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * Parses a CSV string into an array of simple objects.
 * @param {string} csvText - Input CSV text content
 * @returns {Array<Object>} - Decoded array of objects
 */
function csvToJson(csvText) {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];

  // Helper to parse a line honoring double quotes
  function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // escaped quote
          current += '"';
          i++; // skip next quote
        } else {
          // toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseCsvLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < headers.length) continue; // skip malformed lines
    
    const obj = {};
    headers.forEach((header, idx) => {
      // remove leading/trailing spaces and structure values
      const key = header.trim();
      const val = values[idx] ? values[idx].trim() : '';
      
      // support nested keys during ingestion (e.g. personal.name)
      if (key.includes('.')) {
        const parts = key.split('.');
        let current = obj;
        for (let p = 0; p < parts.length - 1; p++) {
          if (!current[parts[p]]) current[parts[p]] = {};
          current = current[parts[p]];
        }
        current[parts[parts.length - 1]] = val;
      } else {
        obj[key] = val;
      }
    });
    records.push(obj);
  }

  return records;
}

module.exports = {
  jsonToCsv,
  csvToJson
};

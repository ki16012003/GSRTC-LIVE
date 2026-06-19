const ExcelJS = require('exceljs');
const busService = require('./busService');

function extractTokensFromText(text) {
  return text
    .split(/[\r\n,;\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

async function extractTokensFromBuffer(buffer, originalName) {
  const ext = (originalName.split('.').pop() || '').toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const tokens = [];
    workbook.worksheets.forEach((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const value = cell.value;
          if (value === null || value === undefined) return;
          const str = String(value.text ?? value).trim();
          if (str) tokens.push(str);
        });
      });
    });
    return tokens;
  }

  // txt / csv / manual paste
  return extractTokensFromText(buffer.toString('utf8'));
}

function importVehicleNos(rawTokens) {
  const cleaned = rawTokens
    .map((t) => busService.normalizeVehicleNo(t))
    .filter(Boolean);
  return busService.addBuses(cleaned);
}

module.exports = { extractTokensFromText, extractTokensFromBuffer, importVehicleNos };

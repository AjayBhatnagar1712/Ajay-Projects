import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "D:/DCAM/Guruvandan app/Mehi Awakening/Lynin manufacturer.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheetSummary = await workbook.inspect({
  kind: "sheet",
  include: "name",
  maxChars: 1000,
});
console.log(sheetSummary.ndjson);

const headerCheck = await workbook.inspect({
  kind: "table",
  range: "Manufacturers!A1:D3",
  include: "values,formulas",
  tableMaxRows: 3,
  tableMaxCols: 4,
});
console.log(headerCheck.ndjson);

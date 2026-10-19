import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "D:/DCAM/Guruvandan app/Mehi Awakening";
const outputPath = `${outputDir}/Lynin manufacturer.xlsx`;
const fontFamily = "Arial";

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Manufacturers");

sheet.showGridLines = false;

sheet.getRange("A1:D1").values = [["s.no", "name", "location", "conversation"]];
sheet.getRange("A1:D1").format = {
  fill: "#1F4E78",
  font: { name: fontFamily, size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};

sheet.getRange("A2:D51").values = Array.from({ length: 50 }, () => ["", "", "", ""]);
sheet.getRange("A1:D51").format.font = { name: fontFamily, size: 10 };
sheet.getRange("A1:D51").format.verticalAlignment = "center";
sheet.getRange("A2:A51").format.horizontalAlignment = "center";
sheet.getRange("A2:D51").format.borders = { preset: "all", style: "thin", color: "#D9E2F3" };
sheet.getRange("A1:D1").format.borders = { preset: "all", style: "thin", color: "#FFFFFF" };
sheet.getRange("A:A").format.columnWidth = 8;
sheet.getRange("B:B").format.columnWidth = 28;
sheet.getRange("C:C").format.columnWidth = 28;
sheet.getRange("D:D").format.columnWidth = 40;
sheet.getRange("A1:D51").format.wrapText = false;
sheet.freezePanes.freezeRows(1);

const table = sheet.tables.add("A1:D51", true, "LyninManufacturerTable");
table.style = "TableStyleMedium2";
table.showFilterButton = true;

workbook.recalculate();

const check = await workbook.inspect({
  kind: "table",
  range: "Manufacturers!A1:D5",
  include: "values,formulas",
  tableMaxRows: 5,
  tableMaxCols: 4,
});
console.log(check.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Manufacturers",
  range: "A1:D12",
  scale: 2,
  format: "png",
});
await fs.writeFile(`${outputDir}/Lynin manufacturer preview.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`Saved ${outputPath}`);

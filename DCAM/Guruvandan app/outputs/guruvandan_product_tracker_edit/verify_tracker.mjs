import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "D:/DCAM/Guruvandan app/outputs/guruvandan_product_tracker_edit/Product Tracker_Guru Vandan_edited.xlsx";
const outputDir = "D:/DCAM/Guruvandan app/outputs/guruvandan_product_tracker_edit";

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

for (const [sheetName, range] of [
  ["Master", "A1:B17"],
  ["Technical Development", "A1:E13"],
  ["Marketing", "A1:C6"],
  ["Version 0 Details", "A1:F24"],
  ["Version 0 Details", "A24:F55"],
]) {
  const preview = await workbook.render({
    sheetName,
    range,
    scale: 2,
    format: "png",
  });
  const suffix = range.replaceAll(":", "_").replaceAll(" ", "");
  await fs.writeFile(
    `${outputDir}/verified_${sheetName.replaceAll(" ", "_")}_${suffix}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const keyRanges = await workbook.inspect({
  kind: "table",
  range: "Technical Development!A1:E13",
  include: "values,formulas",
  tableMaxRows: 13,
  tableMaxCols: 5,
});
console.log("TECHNICAL DEVELOPMENT");
console.log(keyRanges.ndjson);

const detailCheck = await workbook.inspect({
  kind: "table",
  range: "Version 0 Details!A1:F55",
  include: "values,formulas",
  tableMaxRows: 14,
  tableMaxCols: 6,
  tableMaxCellChars: 80,
});
console.log("VERSION 0 DETAILS");
console.log(detailCheck.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log("ERROR SCAN");
console.log(errors.ndjson);

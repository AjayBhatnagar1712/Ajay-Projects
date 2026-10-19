import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/ajayb/Downloads/Product Tracker_Guru Vandan.xlsx";
const outputDir = "D:/DCAM/Guruvandan app/outputs/guruvandan_product_tracker_edit";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 8000,
  tableMaxRows: 12,
  tableMaxCols: 8,
  tableMaxCellChars: 80,
});
console.log("WORKBOOK SUMMARY");
console.log(summary.ndjson);

for (const sheetName of ["Master", "Technical Development", "Marketing"]) {
  try {
    const region = await workbook.inspect({
      kind: "region,computedStyle",
      sheetId: sheetName,
      range: "A1:H20",
      maxChars: 6000,
      tableMaxRows: 20,
      tableMaxCols: 8,
      tableMaxCellChars: 100,
    });
    console.log(`\nSHEET ${sheetName}`);
    console.log(region.ndjson);

    const preview = await workbook.render({
      sheetName,
      range: "A1:H20",
      scale: 2,
      format: "png",
    });
    await fs.writeFile(
      `${outputDir}/preview_${sheetName.replaceAll(" ", "_")}.png`,
      new Uint8Array(await preview.arrayBuffer()),
    );
  } catch (error) {
    console.log(`Skipped ${sheetName}: ${error.message}`);
  }
}

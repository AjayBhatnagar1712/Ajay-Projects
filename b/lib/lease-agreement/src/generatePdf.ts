import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import { generateLeaseAgreementText } from "./agreementText.js";
import { toWinAnsiSafe } from "./format.js";
import {
  CONTENT_BOTTOM_MARGIN,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  SIGNATURE_SLOT_COUNT,
  SIGNATURE_SLOTS,
} from "./signatureSlots.js";
import type {
  LeaseAgreementPdfInput,
  LeaseAgreementPdfResult,
  LeaseInventoryItemPdfInput,
  LeasePartyPdfInput,
} from "./types.js";

const MARGIN_X = 48;
const MARGIN_TOP = 52;
const BODY_SIZE = 10;
const TITLE_SIZE = 12;
const LINE_HEIGHT = 14;
const TITLE_LINE_HEIGHT = 16;
const TABLE_ROW_HEIGHT = 18;
const QTY_COL_WIDTH = 72;
const STROKE = rgb(0.35, 0.35, 0.35);
const TEXT = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.45, 0.45, 0.45);

const INVENTORY_TABLE_HEADER = "Description | Quantity";

function sortByOrder<T extends { sortOrder: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
}

function wrapLine(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const safe = toWinAnsiSafe(text);
  if (!safe) return [""];
  const words = safe.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
    } else {
      // Hard-break oversized tokens
      let chunk = "";
      for (const ch of word) {
        const next = chunk + ch;
        if (font.widthOfTextAtSize(next, size) > maxWidth && chunk) {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = next;
        }
      }
      current = chunk;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type DrawnLine = {
  text: string;
  size: number;
  lineHeight: number;
  bold?: boolean;
  /** Draw Annexure-1 Description | Quantity table instead of plain text. */
  inventoryTable?: boolean;
};

function textToLines(
  text: string,
  font: PDFFont,
  boldFont: PDFFont,
  maxWidth: number,
): DrawnLine[] {
  const out: DrawnLine[] = [];
  for (const raw of text.split("\n")) {
    const isTitle =
      raw === "LEAVE & LICENCE AGREEMENT" || raw.startsWith("ANNEXURE - 1");
    const isHeading =
      raw === "BETWEEN" ||
      raw === "AND" ||
      raw.startsWith("IN WITNESS") ||
      raw === "LICENSOR:" ||
      raw === "LICENSEES:" ||
      raw === "DESCRIPTION OF THE SAID PREMISES:";
    const size = isTitle ? TITLE_SIZE : BODY_SIZE;
    const lineHeight = isTitle ? TITLE_LINE_HEIGHT : LINE_HEIGHT;
    const bold = isTitle || isHeading;
    const fontForWidth = bold ? boldFont : font;
    const wrapped = wrapLine(raw, fontForWidth, size, maxWidth);
    for (const line of wrapped) {
      out.push({ text: line, size, lineHeight, bold });
    }
  }
  return out;
}

/**
 * Collapse pipe-table text lines into a single inventoryTable marker so the
 * PDF can draw a bordered two-column table from structured inventory input.
 */
function collapseInventoryTableLines(lines: DrawnLine[]): DrawnLine[] {
  const out: DrawnLine[] = [];
  let i = 0;
  while (i < lines.length) {
    const current = lines[i];
    if (!current) break;
    if (current.text === INVENTORY_TABLE_HEADER) {
      out.push({
        text: INVENTORY_TABLE_HEADER,
        size: BODY_SIZE,
        lineHeight: LINE_HEIGHT,
        bold: true,
        inventoryTable: true,
      });
      i += 1;
      while (i < lines.length) {
        const next = lines[i];
        if (!next || !next.text.includes(" | ") || next.text.startsWith("*")) {
          break;
        }
        i += 1;
      }
      continue;
    }
    out.push(current);
    i += 1;
  }
  return out;
}

function drawSignatureFooter(
  page: PDFPage,
  font: PDFFont,
  parties: LeasePartyPdfInput[],
): void {
  const ordered = sortByOrder(parties).slice(0, SIGNATURE_SLOT_COUNT);
  page.drawText("Signatures", {
    x: SIGNATURE_SLOTS[0]?.x ?? 40,
    y: CONTENT_BOTTOM_MARGIN - 4,
    size: 7,
    font,
    color: MUTED,
  });

  for (const slot of SIGNATURE_SLOTS) {
    const party = ordered[slot.index - 1];
    // Unused slots: draw nothing (no box, no label). Never move coordinates.
    if (!party) continue;

    page.drawRectangle({
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      borderColor: STROKE,
      borderWidth: 0.75,
    });

    const roleLabel = party.role === "owner" ? "Owner" : "Tenant";
    const maxNameWidth = slot.width - 10;
    let name = toWinAnsiSafe(party.name);
    while (
      name.length > 1 &&
      font.widthOfTextAtSize(name, 8) > maxNameWidth
    ) {
      name = `${name.slice(0, -4)}...`;
    }
    page.drawText(toWinAnsiSafe(`${slot.index}. ${roleLabel}`), {
      x: slot.x + 5,
      y: slot.y + slot.height - 14,
      size: 7.5,
      font,
      color: MUTED,
    });
    page.drawText(name, {
      x: slot.x + 5,
      y: slot.y + 10,
      size: 8,
      font,
      color: TEXT,
    });
  }
}

function drawInventoryTable(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  startY: number,
  items: LeaseInventoryItemPdfInput[],
): number {
  const tableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const descWidth = tableWidth - QTY_COL_WIDTH;
  const rows: { description: string; quantity: string; header?: boolean }[] = [
    { description: "Description", quantity: "Quantity", header: true },
    ...sortByOrder(items).map((item) => ({
      description: toWinAnsiSafe(item.description),
      quantity: toWinAnsiSafe(String(item.quantity)),
    })),
  ];

  let y = startY;
  for (const row of rows) {
    const useFont = row.header ? boldFont : font;
    const descLines = wrapLine(row.description, useFont, BODY_SIZE, descWidth - 10);
    const rowHeight = Math.max(TABLE_ROW_HEIGHT, descLines.length * LINE_HEIGHT + 6);
    const bottom = y - rowHeight;

    page.drawRectangle({
      x: MARGIN_X,
      y: bottom,
      width: tableWidth,
      height: rowHeight,
      borderColor: STROKE,
      borderWidth: 0.75,
    });
    page.drawLine({
      start: { x: MARGIN_X + descWidth, y: bottom },
      end: { x: MARGIN_X + descWidth, y },
      thickness: 0.75,
      color: STROKE,
    });

    let textY = y - BODY_SIZE - 4;
    for (const segment of descLines) {
      page.drawText(segment, {
        x: MARGIN_X + 5,
        y: textY,
        size: BODY_SIZE,
        font: useFont,
        color: TEXT,
      });
      textY -= LINE_HEIGHT;
    }

    const qtyWidth = useFont.widthOfTextAtSize(row.quantity, BODY_SIZE);
    page.drawText(row.quantity, {
      x: MARGIN_X + descWidth + (QTY_COL_WIDTH - qtyWidth) / 2,
      y: y - BODY_SIZE - 4,
      size: BODY_SIZE,
      font: useFont,
      color: TEXT,
    });

    y = bottom;
  }
  return y - 6;
}

function paintPages(
  doc: PDFDocument,
  lines: DrawnLine[],
  font: PDFFont,
  boldFont: PDFFont,
  parties: LeasePartyPdfInput[],
  inventoryItems: LeaseInventoryItemPdfInput[],
): number {
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN_TOP;
  let pageCount = 1;

  const newPage = () => {
    drawSignatureFooter(page, font, parties);
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_TOP;
    pageCount += 1;
  };

  for (const line of lines) {
    if (line.inventoryTable) {
      const sorted = sortByOrder(inventoryItems);
      const estimatedHeight = TABLE_ROW_HEIGHT * (sorted.length + 1) + 8;
      if (y - estimatedHeight < CONTENT_BOTTOM_MARGIN) {
        newPage();
      }
      y = drawInventoryTable(page, font, boldFont, y, sorted);
      continue;
    }

    if (y - line.lineHeight < CONTENT_BOTTOM_MARGIN) {
      newPage();
    }
    const useFont = line.bold ? boldFont : font;
    const safeText = toWinAnsiSafe(line.text);
    const segments =
      useFont.widthOfTextAtSize(safeText, line.size) > maxWidth
        ? wrapLine(safeText, useFont, line.size, maxWidth)
        : [safeText];
    for (const segment of segments) {
      if (y - line.lineHeight < CONTENT_BOTTOM_MARGIN) {
        newPage();
      }
      page.drawText(segment, {
        x: MARGIN_X,
        y: y - line.size,
        size: line.size,
        font: useFont,
        color: TEXT,
      });
      y -= line.lineHeight;
    }
  }

  drawSignatureFooter(page, font, parties);
  return pageCount;
}

export async function generateLeaseAgreementPdf(
  input: LeaseAgreementPdfInput,
): Promise<LeaseAgreementPdfResult> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2;

  const body = generateLeaseAgreementText(input);
  const lines = collapseInventoryTableLines(
    textToLines(body, font, boldFont, maxWidth),
  );

  const pageCount = paintPages(
    doc,
    lines,
    font,
    boldFont,
    input.parties,
    input.inventoryItems,
  );
  const bytes = await doc.save();
  return { bytes, pageCount };
}

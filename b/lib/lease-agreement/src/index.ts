export type {
  LeaseAgreementPdfInput,
  LeaseAgreementPdfResult,
  LeaseInventoryItemPdfInput,
  LeasePartyPdfInput,
  LeasePartyRole,
} from "./types.js";

export {
  formatDateYmd,
  formatDayMonthYearWithSuffix,
  formatExecutionDayParts,
  formatIndianGroupedInteger,
  formatInrPaise,
  numberToWords,
  ordSuffix,
  paiseToRupees,
  toWinAnsiSafe,
} from "./format.js";

export type {
  LeaseAgreementDocument,
  LeaseAgreementDocumentLine,
  LeaseAgreementHighlightKind,
  LeaseAgreementTextRun,
} from "./agreementText.js";

export {
  flattenLeaseAgreementDocument,
  generateLeaseAgreementDocument,
  generateLeaseAgreementText,
} from "./agreementText.js";

export {
  CONTENT_BOTTOM_MARGIN,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  SIGNATURE_MARGIN_X,
  SIGNATURE_SLOT_COUNT,
  SIGNATURE_SLOTS,
  SIGNATURE_USABLE_WIDTH,
  type SignatureSlot,
} from "./signatureSlots.js";

export { generateLeaseAgreementPdf } from "./generatePdf.js";

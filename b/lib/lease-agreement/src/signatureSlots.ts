/**
 * Fixed signature stamp layout for every PDF page.
 *
 * Shape: horizontally-flipped "L"
 * - Slots 1–3: one full-width bottom row (evenly spaced across usable width)
 * - Slots 4–5: stacked vertically above slot 3 only (same x/width as slot 3),
 *   climbing the right side of the page
 *
 * Unused slots stay drawn but unlabelled when fewer than 5 parties sign —
 * matches the Leegality 5-invitee workflow.
 *
 * Coordinates are pdf-lib / PDF user space: origin bottom-left, A4 points
 * (PAGE_WIDTH × PAGE_HEIGHT). y is the bottom edge of each stamp box.
 *
 * CAUTION — provisional until verified against Leegality's placement UI.
 * Phase 4 stamp placement should import these constants; do not re-hardcode.
 * Re-measure after uploading the max-case sample PDF to the Leegality dashboard.
 */

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;

export const SIGNATURE_SLOT_COUNT = 5;

export type SignatureSlot = {
  /** 1-based slot index matching Leegality invitee order. */
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Side inset for the bottom signature row. */
export const SIGNATURE_MARGIN_X = 40;

/** Usable width for the bottom stamp row: A4 minus left/right margins. */
export const SIGNATURE_USABLE_WIDTH = PAGE_WIDTH - SIGNATURE_MARGIN_X * 2;

const SLOT_GAP = 18;
const SLOT_HEIGHT = 52;
const BOTTOM_ROW_Y = 40;
const BOTTOM_ROW_COUNT = 3;

const BOTTOM_SLOT_WIDTH =
  (SIGNATURE_USABLE_WIDTH - SLOT_GAP * (BOTTOM_ROW_COUNT - 1)) /
  BOTTOM_ROW_COUNT;

function bottomSlotX(col: number): number {
  return SIGNATURE_MARGIN_X + col * (BOTTOM_SLOT_WIDTH + SLOT_GAP);
}

const SLOT_3_X = bottomSlotX(2);
const SLOT_4_Y = BOTTOM_ROW_Y + SLOT_HEIGHT + SLOT_GAP;
const SLOT_5_Y = SLOT_4_Y + SLOT_HEIGHT + SLOT_GAP;

/**
 * Frozen flipped-L map — import from here in Phase 4.
 *
 * Bottom row (1–3): three equal boxes across SIGNATURE_USABLE_WIDTH.
 * Right stack (4–5): two boxes stacked above slot 3 only.
 *
 * CRITICAL: these 5 coordinates are FIXED and must NEVER vary by party count.
 * We use a single Leegality workflow with 5 pre-configured invitee slots;
 * each slot's stamp coordinate is set once on Leegality's dashboard, keyed
 * to slot number (1–5), not to how many parties a given document has.
 * If these coordinates were made dynamic (e.g. to fill unused space when
 * there are fewer than 5 parties), slot N's position would no longer match
 * what Leegality has configured for slot N, and stamps would land in the
 * wrong place on some subset of documents.
 *
 * If you need better visual balance for documents with fewer signers,
 * solve it by NOT DRAWING unused slots (see generatePdf.ts) — never by
 * moving where a slot number is positioned.
 *
 * CAUTION — provisional until verified against Leegality's placement UI.
 */
export const SIGNATURE_SLOTS: readonly SignatureSlot[] = [
  {
    index: 1,
    x: bottomSlotX(0),
    y: BOTTOM_ROW_Y,
    width: BOTTOM_SLOT_WIDTH,
    height: SLOT_HEIGHT,
  },
  {
    index: 2,
    x: bottomSlotX(1),
    y: BOTTOM_ROW_Y,
    width: BOTTOM_SLOT_WIDTH,
    height: SLOT_HEIGHT,
  },
  {
    index: 3,
    x: SLOT_3_X,
    y: BOTTOM_ROW_Y,
    width: BOTTOM_SLOT_WIDTH,
    height: SLOT_HEIGHT,
  },
  {
    index: 4,
    x: SLOT_3_X,
    y: SLOT_4_Y,
    width: BOTTOM_SLOT_WIDTH,
    height: SLOT_HEIGHT,
  },
  {
    index: 5,
    x: SLOT_3_X,
    y: SLOT_5_Y,
    width: BOTTOM_SLOT_WIDTH,
    height: SLOT_HEIGHT,
  },
] as const;

/** Content must stay above this y so it never overlaps the stamp footer. */
export const CONTENT_BOTTOM_MARGIN = SLOT_5_Y + SLOT_HEIGHT + 16;

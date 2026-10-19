import { z } from "zod";

export function fieldCannotBeEmpty(label: string): string {
  return `${label} cannot be empty`;
}

export const MONEY_FORMAT_ERROR =
  "Enter rupees with at most 2 decimal places";
export const WHOLE_NUMBER_ERROR = "Enter a whole number";
export const DATE_FORMAT_ERROR = "Use YYYY-MM-DD";
export const DATE_INVALID_ERROR = "Enter a valid date";
export const RENT_DUE_RANGE_ERROR = "Enter a day from 1 to 31";
export const MIN_DURATION_MONTHS_ERROR =
  "Agreement must be at least one month";

function addEmptyOr(
  trimmed: string,
  label: string,
  ctx: z.RefinementCtx,
  whenFilled: () => void,
): void {
  if (trimmed.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: fieldCannotBeEmpty(label),
    });
    return;
  }
  whenFilled();
}

/** Blank → "[label] cannot be empty"; non-blank invalid → format message. */
export function labeledDateText(label: string) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim();
    addEmptyOr(trimmed, label, ctx, () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: DATE_FORMAT_ERROR,
        });
        return;
      }
      if (Number.isNaN(new Date(`${trimmed}T00:00:00Z`).getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: DATE_INVALID_ERROR,
        });
      }
    });
  });
}

export function labeledRequiredText(label: string) {
  return z.string().superRefine((value, ctx) => {
    if (value.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: fieldCannotBeEmpty(label),
      });
    }
  });
}

export function labeledWholeNumberText(label: string) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim();
    addEmptyOr(trimmed, label, ctx, () => {
      if (!/^\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: WHOLE_NUMBER_ERROR,
        });
      }
    });
  });
}

export function labeledMoneyText(label: string) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim();
    addEmptyOr(trimmed, label, ctx, () => {
      if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MONEY_FORMAT_ERROR,
        });
      }
    });
  });
}

export function labeledRentDueDayText(label: string) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim();
    addEmptyOr(trimmed, label, ctx, () => {
      if (!/^\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: RENT_DUE_RANGE_ERROR,
        });
        return;
      }
      const day = Number(trimmed);
      if (day < 1 || day > 31) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: RENT_DUE_RANGE_ERROR,
        });
      }
    });
  });
}

/**
 * Derived duration in whole months. Empty when Start/End are incomplete.
 * "0" means a valid date range shorter than one calendar month — rejected.
 */
export function labeledDurationMonthsText(label: string) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim();
    addEmptyOr(trimmed, label, ctx, () => {
      if (!/^\d+$/.test(trimmed) || Number(trimmed) > 600) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: WHOLE_NUMBER_ERROR,
        });
        return;
      }
      if (Number(trimmed) < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: MIN_DURATION_MONTHS_ERROR,
        });
      }
    });
  });
}

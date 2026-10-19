import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import {
  fieldCannotBeEmpty,
  labeledDateText,
  labeledDurationMonthsText,
  labeledMoneyText,
  labeledRentDueDayText,
  labeledRequiredText,
  labeledWholeNumberText,
  MIN_DURATION_MONTHS_ERROR,
  MONEY_FORMAT_ERROR,
  RENT_DUE_RANGE_ERROR,
  WHOLE_NUMBER_ERROR,
} from "./termsFieldValidation";

function firstIssue(schema: ZodTypeAny, value: string): string | undefined {
  const result = schema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("fieldCannotBeEmpty", () => {
  it("uses the field label", () => {
    expect(fieldCannotBeEmpty("Monthly rent")).toBe(
      "Monthly rent cannot be empty",
    );
    expect(fieldCannotBeEmpty("City")).toBe("City cannot be empty");
  });
});

describe("labeledMoneyText", () => {
  const schema = labeledMoneyText("Monthly rent");

  it("rejects blank with the cannot-be-empty message", () => {
    expect(firstIssue(schema, "")).toBe("Monthly rent cannot be empty");
    expect(firstIssue(schema, "   ")).toBe("Monthly rent cannot be empty");
  });

  it("rejects non-blank invalid format with the rupees message", () => {
    expect(firstIssue(schema, "12.345")).toBe(MONEY_FORMAT_ERROR);
  });

  it("accepts valid rupees", () => {
    expect(schema.safeParse("45000").success).toBe(true);
    expect(schema.safeParse("45000.50").success).toBe(true);
  });
});

describe("labeledDateText", () => {
  const schema = labeledDateText("Start date");

  it("rejects blank with the cannot-be-empty message", () => {
    expect(firstIssue(schema, "")).toBe("Start date cannot be empty");
  });

  it("accepts ISO dates", () => {
    expect(schema.safeParse("2026-08-14").success).toBe(true);
  });
});

describe("labeledRequiredText / labeledWholeNumberText", () => {
  it("rejects blank city", () => {
    expect(firstIssue(labeledRequiredText("City"), "")).toBe(
      "City cannot be empty",
    );
  });

  it("rejects blank lock-in, keeps format error for junk", () => {
    const schema = labeledWholeNumberText("Lock-in period");
    expect(firstIssue(schema, "")).toBe("Lock-in period cannot be empty");
    expect(firstIssue(schema, "1.5")).toBe(WHOLE_NUMBER_ERROR);
    expect(schema.safeParse("0").success).toBe(true);
  });
});

describe("labeledDurationMonthsText", () => {
  const schema = labeledDurationMonthsText("Duration");

  it("rejects 0 with the min-duration message, not greater-than-zero", () => {
    expect(firstIssue(schema, "0")).toBe(MIN_DURATION_MONTHS_ERROR);
  });

  it("accepts 1 month and above", () => {
    expect(schema.safeParse("1").success).toBe(true);
    expect(schema.safeParse("11").success).toBe(true);
  });

  it("rejects empty (dates not yet a valid range)", () => {
    expect(firstIssue(schema, "")).toBe("Duration cannot be empty");
  });
});

describe("labeledRentDueDayText", () => {
  const schema = labeledRentDueDayText("Rent due date");

  it("rejects blank vs out-of-range separately", () => {
    expect(firstIssue(schema, "")).toBe("Rent due date cannot be empty");
    expect(firstIssue(schema, "32")).toBe(RENT_DUE_RANGE_ERROR);
  });
});

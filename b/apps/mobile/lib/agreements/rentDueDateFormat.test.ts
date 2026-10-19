import { describe, expect, it } from "vitest";
import {
  formatRentDueDateDisplay,
  parseRentDueDayInput,
} from "./rentDueDateFormat";

describe("parseRentDueDayInput", () => {
  it("keeps only digits up to 2 characters", () => {
    expect(parseRentDueDayInput("3rd of every month")).toBe("3");
    expect(parseRentDueDayInput("21st")).toBe("21");
    expect(parseRentDueDayInput("ab")).toBe("");
    expect(parseRentDueDayInput("315")).toBe("31");
  });

  it("rejects 0 and values above 31 (keeps prior valid digit)", () => {
    expect(parseRentDueDayInput("0")).toBe("");
    expect(parseRentDueDayInput("00")).toBe("");
    expect(parseRentDueDayInput("32")).toBe("3");
    expect(parseRentDueDayInput("99")).toBe("9");
    expect(parseRentDueDayInput("05")).toBe("5");
  });

  it("allows every day from 1 to 31", () => {
    for (let day = 1; day <= 31; day += 1) {
      expect(parseRentDueDayInput(String(day))).toBe(String(day));
    }
  });
});

describe("formatRentDueDateDisplay", () => {
  it("is empty until a valid day is entered", () => {
    expect(formatRentDueDateDisplay("")).toBe("");
    expect(formatRentDueDateDisplay("0")).toBe("");
    expect(formatRentDueDateDisplay("32")).toBe("3rd of every month");
  });

  it("builds continuous day+particle+space+phrase for non-input surfaces only", () => {
    expect(formatRentDueDateDisplay("1")).toBe("1st of every month");
    expect(formatRentDueDateDisplay("2")).toBe("2nd of every month");
    expect(formatRentDueDateDisplay("3")).toBe("3rd of every month");
    expect(formatRentDueDateDisplay("4")).toBe("4th of every month");
    expect(formatRentDueDateDisplay("5")).toBe("5th of every month");
    expect(formatRentDueDateDisplay("11")).toBe("11th of every month");
    expect(formatRentDueDateDisplay("21")).toBe("21st of every month");
  });

  it("round-trips display strings back to storeable digits", () => {
    expect(parseRentDueDayInput(formatRentDueDateDisplay("21"))).toBe("21");
    expect(parseRentDueDayInput(formatRentDueDateDisplay("6"))).toBe("6");
  });
});

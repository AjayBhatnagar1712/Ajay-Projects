import { describe, expect, it } from "vitest";
import {
  canDecrementQuantity,
  MIN_STEPPER_VALUE,
  stepQuantity,
} from "./stepQuantity";

describe("stepQuantity", () => {
  it("increments from 1", () => {
    expect(stepQuantity(1, 1)).toBe(2);
  });

  it("decrements above the floor", () => {
    expect(stepQuantity(3, -1)).toBe(2);
  });

  it("does not go below 1", () => {
    expect(stepQuantity(MIN_STEPPER_VALUE, -1)).toBe(MIN_STEPPER_VALUE);
  });

  it("treats non-integers as the floor", () => {
    expect(stepQuantity(1.5, 1)).toBe(MIN_STEPPER_VALUE);
  });
});

describe("canDecrementQuantity", () => {
  it("disables minus at 1", () => {
    expect(canDecrementQuantity(1)).toBe(false);
  });

  it("enables minus above 1", () => {
    expect(canDecrementQuantity(2)).toBe(true);
  });
});

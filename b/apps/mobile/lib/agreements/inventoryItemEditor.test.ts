import { describe, expect, it } from "vitest";
import {
  inventoryDescriptionError,
  inventoryQuantityError,
} from "./inventoryItemEditor";

describe("inventoryDescriptionError", () => {
  it("requires a non-empty description", () => {
    expect(inventoryDescriptionError("")).toBe("Description is required");
    expect(inventoryDescriptionError("   ")).toBe("Description is required");
  });

  it("accepts trimmed text", () => {
    expect(inventoryDescriptionError("Ceiling fans")).toBeNull();
  });
});

describe("inventoryQuantityError", () => {
  it("rejects missing or sub-1 values", () => {
    expect(inventoryQuantityError(undefined)).toBe("Quantity is required");
    expect(inventoryQuantityError(0)).toBe("Quantity must be at least 1");
    expect(inventoryQuantityError(1.5)).toBe("Quantity must be at least 1");
  });

  it("accepts integers ≥ 1", () => {
    expect(inventoryQuantityError(1)).toBeNull();
    expect(inventoryQuantityError(4)).toBeNull();
  });
});

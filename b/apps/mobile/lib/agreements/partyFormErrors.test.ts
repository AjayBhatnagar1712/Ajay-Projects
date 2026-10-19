import { describe, expect, it } from "vitest";
import {
  fieldIdsToExpandForInvalidParties,
  fieldIdsToExpandForPartyErrors,
  indexesWithDuplicatePhones,
  isUniquePhonePartyError,
  partyHasFieldErrors,
  partyIndexesWithFieldErrors,
  rootPartyErrorMessage,
  UNIQUE_PHONE_MESSAGE,
} from "./partyFormErrors";

describe("partyIndexesWithFieldErrors", () => {
  it("reads sparse array-shaped RHF errors", () => {
    const errors = [
      undefined,
      { phone: { message: "Phone must be a 10-digit number", type: "custom" } },
    ];
    expect(partyIndexesWithFieldErrors(errors, 2)).toEqual([1]);
  });

  it("reads object-shaped Zod/RHF errors (the shipped bug)", () => {
    // This is the shape that made `Array.isArray` fail and skipped auto-expand.
    const errors = {
      1: {
        age: { message: "Age is required", type: "custom" },
        address: { message: "Address is required", type: "custom" },
      },
      message: "Between 1 and 5 parties are required",
    };
    expect(partyIndexesWithFieldErrors(errors, 2)).toEqual([1]);
    expect(partyHasFieldErrors(errors, 0)).toBe(false);
    expect(partyHasFieldErrors(errors, 1)).toBe(true);
  });

  it("returns empty when only a root message exists", () => {
    expect(
      partyIndexesWithFieldErrors({ message: "At least one owner is required" }, 2),
    ).toEqual([]);
  });
});

describe("fieldIdsToExpandForPartyErrors", () => {
  it("maps error indexes to field-array ids for auto-expand", () => {
    const fieldIds = ["owner-blank", "tenant-named"];
    const errors = {
      1: { phone: { message: "required", type: "custom" } },
    };
    expect(fieldIdsToExpandForPartyErrors(fieldIds, errors)).toEqual([
      "tenant-named",
    ]);
  });

  it("expands every errored party when several fail", () => {
    const fieldIds = ["a", "b", "c"];
    const errors = [
      { name: { message: "Name is required", type: "custom" } },
      undefined,
      { email: { message: "Email is required", type: "custom" } },
    ];
    expect(fieldIdsToExpandForPartyErrors(fieldIds, errors)).toEqual(["a", "c"]);
  });
});

/**
 * Regression: collapse a party that only has a name, submit → missing required
 * fields must be detected on the object-shaped error bag and map to expand.
 */
describe("collapsed party submit regression", () => {
  it("detects collapsed tenant errors and yields expand id + indicator", () => {
    const fieldIds = ["owner-1", "tenant-1"];
    // Tenant collapsed after name-only entry; Zod/RHF returns object bag.
    const submitErrors = {
      1: {
        title: { message: "Title is required", type: "custom" },
        age: { message: "Age is required", type: "custom" },
        address: { message: "Address is required", type: "custom" },
        aadhaar: { message: "Aadhaar Number is required", type: "custom" },
        email: { message: "Email is required", type: "custom" },
        phone: { message: "Phone must be a 10-digit number", type: "custom" },
      },
    };

    const toExpand = fieldIdsToExpandForPartyErrors(fieldIds, submitErrors);
    expect(toExpand).toEqual(["tenant-1"]);
    expect(partyHasFieldErrors(submitErrors, 1)).toBe(true);
    // Collapsed header indicator for the errored card; owner stays clean.
    expect(partyHasFieldErrors(submitErrors, 0)).toBe(false);
  });
});

describe("unique phone root error discoverability", () => {
  it("reads the root uniqueness message Zod attaches at path parties", () => {
    const errors = { message: UNIQUE_PHONE_MESSAGE, type: "custom" };
    expect(rootPartyErrorMessage(errors)).toBe(UNIQUE_PHONE_MESSAGE);
    expect(isUniquePhonePartyError(errors)).toBe(true);
    expect(partyIndexesWithFieldErrors(errors, 2)).toEqual([]);
  });

  it("indexes every party that shares a duplicate phone", () => {
    expect(
      indexesWithDuplicatePhones(["9999999999", "8888888888", "9999999999"]),
    ).toEqual([0, 2]);
    expect(indexesWithDuplicatePhones(["111", "222"])).toEqual([]);
  });

  it("expands duplicate-phone parties when only the root message exists", () => {
    const fieldIds = ["owner-1", "tenant-1", "tenant-2"];
    const errors = { message: UNIQUE_PHONE_MESSAGE };
    const phones = ["9876543210", "9876543210", "9111111111"];
    expect(fieldIdsToExpandForInvalidParties(fieldIds, errors, phones)).toEqual([
      "owner-1",
      "tenant-1",
    ]);
  });

  it("prefers field-level expand over duplicate-phone expand", () => {
    const fieldIds = ["owner-1", "tenant-1"];
    const errors = {
      message: UNIQUE_PHONE_MESSAGE,
      1: { name: { message: "Name is required", type: "custom" } },
    };
    expect(
      fieldIdsToExpandForInvalidParties(fieldIds, errors, [
        "9876543210",
        "9876543210",
      ]),
    ).toEqual(["tenant-1"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  submitTenantRentExtensionRequest,
  validateTenantRentExtensionInput,
} from "./tenantRentExtension";

describe("tenantRentExtension", () => {
  it("requires date and reason", () => {
    expect(
      validateTenantRentExtensionInput({
        requestedDate: "",
        reason: "",
        minimumExtensionDate: "2026-05-06",
      }),
    ).toEqual({ ok: false, message: "Please select a requested extension date." });

    expect(
      validateTenantRentExtensionInput({
        requestedDate: "2026-05-10",
        reason: "",
        minimumExtensionDate: "2026-05-06",
      }),
    ).toEqual({ ok: false, message: "Please provide a reason for the extension." });
  });

  it("rejects extension dates on or before the current due date", () => {
    expect(
      validateTenantRentExtensionInput({
        requestedDate: "2026-05-05",
        reason: "Late salary",
        minimumExtensionDate: "2026-05-06",
      }),
    ).toEqual({
      ok: false,
      message: "Requested extension date must be after your current due date.",
    });
  });

  it("accepts valid extension input", () => {
    expect(
      validateTenantRentExtensionInput({
        requestedDate: "2026-05-10",
        reason: "Late salary",
        minimumExtensionDate: "2026-05-06",
      }),
    ).toEqual({ ok: true });
  });

  it("submits a mock extension request", async () => {
    await expect(
      submitTenantRentExtensionRequest({
        requestedDate: "2026-05-10",
        reason: "Late salary",
      }),
    ).resolves.toBeUndefined();
  });
});

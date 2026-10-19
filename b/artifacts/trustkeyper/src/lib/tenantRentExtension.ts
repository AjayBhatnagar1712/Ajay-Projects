export type TenantRentExtensionValidationResult =
  | { ok: true }
  | { ok: false; message: string };

export function validateTenantRentExtensionInput(input: {
  requestedDate: string;
  reason: string;
  minimumExtensionDate: string;
}): TenantRentExtensionValidationResult {
  if (!input.requestedDate.trim()) {
    return { ok: false, message: "Please select a requested extension date." };
  }

  if (input.requestedDate < input.minimumExtensionDate) {
    return {
      ok: false,
      message: "Requested extension date must be after your current due date.",
    };
  }

  if (!input.reason.trim()) {
    return { ok: false, message: "Please provide a reason for the extension." };
  }

  return { ok: true };
}

export async function submitTenantRentExtensionRequest(input: {
  requestedDate: string;
  reason: string;
}): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 600);
  });

  if (!input.requestedDate || !input.reason.trim()) {
    throw new Error("Extension request could not be submitted.");
  }
}

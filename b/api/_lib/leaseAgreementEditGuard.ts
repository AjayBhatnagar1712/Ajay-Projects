/** Statuses where party, inventory, and commercial fields must not change. */
export function isLeaseAgreementFrozenForEdits(status: string): boolean {
  return status === "esign_sent" || status === "signed";
}

export function leaseAgreementFrozenEditError(status: string): string {
  if (status === "signed") {
    return "This agreement has been signed and can no longer be edited.";
  }
  return "This agreement has been sent for signing and can no longer be edited.";
}

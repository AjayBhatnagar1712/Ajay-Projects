export type AgreementBlobRecord = {
  id: string;
  propertyId?: string;
  propertyTitle?: string;
  ownerName?: string;
  ownerContact?: string;
  tenantName?: string;
  tenantContact?: string;
  status?: string;
  createdAt?: number;
};

export function mergeAgreementIntoBlobList(
  agreements: AgreementBlobRecord[],
  record: AgreementBlobRecord,
): AgreementBlobRecord[] {
  const idx = agreements.findIndex((row) => row.id === record.id);
  if (idx === -1) {
    return [record, ...agreements];
  }
  return agreements.map((row, i) => (i === idx ? { ...row, ...record } : row));
}

export function findAgreementInBlobList(
  agreements: AgreementBlobRecord[],
  agreementId: string,
): AgreementBlobRecord | undefined {
  return agreements.find((row) => row.id === agreementId);
}

export function tenantPhoneFromAgreementContact(contact: string): string {
  return contact.replace(/\D/g, "").slice(-10);
}

export function hasServerWorkspaceSnapshot(workspace: {
  propertyId?: string;
  propertyLabel?: string;
  propertyAddress?: string;
}): boolean {
  if (workspace.propertyLabel?.trim()) return true;
  if (workspace.propertyAddress?.trim()) return true;
  return false;
}

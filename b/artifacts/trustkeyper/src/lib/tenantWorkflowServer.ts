import { getApiBase } from "@/lib/apiBase";
import type { Role } from "./auth";
import type { Agreement } from "./agreements";
import { getActiveSession, normalizePhoneDigits } from "./storageKeys";
import { syncAuthHeaders } from "./syncSession";
import { generateRentalAgreementText, type RentalAgreementInput } from "./rentalAgreementDocument";
import type { TenantAgreementSnapshot, TenantWorkspaceRecord } from "./tenantWorkspace";
import { saveTenantWorkspace } from "./tenantWorkspace";

export type { TenantAgreementSnapshot };

export interface SendAgreementForESignInput {
  phone: string;
  role: "owner" | "broker";
  agreementId: string;
  tenantPhone: string;
  tenantName: string;
  propertyId?: string;
  propertyLabel: string;
  propertyAddress?: string;
  propertyImage?: string;
  monthlyRent?: string;
  securityDeposit?: string;
  propertyType?: string;
  ownerName?: string;
  ownerContact?: string;
  brokerName?: string;
  requesterRole: "owner" | "broker";
  requesterName: string;
  agreementSnapshot: TenantAgreementSnapshot;
  agreementRecord?: Agreement;
}

function workflowUrl(path: string): string {
  return `${getApiBase()}/tenant-workflow/${path}`;
}

export function buildAgreementSnapshotFromAgreement(
  agreement: Agreement,
  propertyAddress?: string,
  isOwnerFlow?: boolean,
): TenantAgreementSnapshot {
  const input: RentalAgreementInput = {
    propertyTitle: agreement.propertyTitle,
    propertyAddress,
    ownerName: agreement.ownerName,
    ownerContact: agreement.ownerContact,
    tenantName: agreement.tenantName,
    tenantContact: agreement.tenantContact,
    coTenantName: agreement.coTenantName,
    coTenantContact: agreement.coTenantContact,
    startDate: agreement.startDate,
    monthlyRent: agreement.monthlyRent,
    securityDeposit: agreement.securityDeposit,
    lockInPeriod: agreement.lockInPeriod,
    noticePeriod: agreement.noticePeriod,
    rentDueDay: agreement.rentDueDay,
    maintenanceCharges: agreement.maintenanceCharges,
    brokerageAmount: agreement.brokerageAmount,
    brokeragePaidBy: agreement.brokeragePaidBy,
    brokerageMode: agreement.brokerageMode,
    isOwnerFlow,
  };

  return {
    ownerName: agreement.ownerName,
    ownerContact: agreement.ownerContact,
    tenantName: agreement.tenantName,
    propertyAddress: propertyAddress ?? agreement.propertyTitle,
    leaseStartDate: agreement.startDate,
    leaseEndDate: agreement.endDate,
    monthlyRent: agreement.monthlyRent,
    securityDeposit: agreement.securityDeposit,
    rentDueDay: agreement.rentDueDay,
    lockInPeriod: agreement.lockInPeriod,
    noticePeriod: agreement.noticePeriod,
    brokerageAmount: agreement.brokerageAmount,
    agreementText: agreement.customText ?? generateRentalAgreementText(input),
  };
}

export async function sendAgreementForESign(
  input: SendAgreementForESignInput,
  accessToken?: string | null,
): Promise<{ ok: true; workspace: TenantWorkspaceRecord } | { ok: false; error: string }> {
  const url = workflowUrl("send-for-esign");
  try {
    const headers = await syncAuthHeaders("application/json", accessToken ?? undefined);
    if (!headers) return { ok: false, error: "Not authenticated" };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    let json: { workspace?: TenantWorkspaceRecord; error?: string };
    try {
      json = (await res.json()) as { workspace?: TenantWorkspaceRecord; error?: string };
    } catch {
      return {
        ok: false,
        error: `Tenant workflow API returned an invalid response (${res.status}). Check that ${url} is reachable.`,
      };
    }

    if (!res.ok) {
      return { ok: false, error: json.error ?? "Failed to send agreement for signing" };
    }

    if (!json.workspace) {
      return { ok: false, error: "Missing workspace in response" };
    }

    return { ok: true, workspace: json.workspace };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `Could not reach the tenant workflow API at ${url}. ${detail}`,
    };
  }
}

export async function pullTenantWorkspaceFromServer(
  phone?: string,
  accessToken?: string | null,
): Promise<TenantWorkspaceRecord | null> {
  const session = getActiveSession();
  const digits = normalizePhoneDigits(phone ?? session?.phone ?? "");
  if (digits.length !== 10) return null;
  if (!phone && (!session || session.role !== "tenant")) return null;

  try {
    const headers = await syncAuthHeaders(undefined, accessToken ?? undefined);
    if (!headers) return null;

    const res = await fetch(workflowUrl(`workspace/${digits}`), { headers });
    if (res.status === 404) return null;
    if (!res.ok) return null;

    const json = (await res.json()) as { workspace?: TenantWorkspaceRecord };
    if (!json.workspace) return null;

    saveTenantWorkspace(json.workspace);
    return json.workspace;
  } catch {
    return null;
  }
}

export async function patchTenantWorkspaceOnServer(
  patch: Partial<TenantWorkspaceRecord> & { phone: string },
): Promise<TenantWorkspaceRecord | null> {
  try {
    const headers = await syncAuthHeaders("application/json");
    if (!headers) return null;

    const res = await fetch(workflowUrl("workspace"), {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { workspace?: TenantWorkspaceRecord };
    if (!json.workspace) return null;

    saveTenantWorkspace(json.workspace);
    return json.workspace;
  } catch {
    return null;
  }
}

export async function upsertTenantWorkspaceOnServer(
  workspace: TenantWorkspaceRecord,
): Promise<TenantWorkspaceRecord | null> {
  return patchTenantWorkspaceOnServer({
    phone: normalizePhoneDigits(workspace.phone),
    tenantName: workspace.tenantName,
    propertyLabel: workspace.propertyLabel,
    propertyId: workspace.propertyId,
    propertyAddress: workspace.propertyAddress,
    propertyImage: workspace.propertyImage,
    monthlyRent: workspace.monthlyRent,
    securityDeposit: workspace.securityDeposit,
    propertyType: workspace.propertyType,
    ownerName: workspace.ownerName,
    ownerContact: workspace.ownerContact,
    brokerName: workspace.brokerName,
    requesterName: workspace.requesterName,
    requesterRole: workspace.requesterRole,
    documentUploadToken: workspace.documentUploadToken,
    documentUploadStatus: workspace.documentUploadStatus,
    lifecycleStage: workspace.lifecycleStage,
    agreementId: workspace.agreementId,
    preSigningEscrowType: workspace.preSigningEscrowType,
    escrowPaymentId: workspace.escrowPaymentId,
    escrowPaymentStatus: workspace.escrowPaymentStatus,
    agreementSnapshot: workspace.agreementSnapshot,
    esignSignedPartyPhones: workspace.esignSignedPartyPhones,
  });
}

export async function recordTenantAgreementSignature(input: {
  phone: string;
  agreementId: string;
  signedPartyPhone: string;
  fileName: string;
  fileUrl: string;
}): Promise<TenantWorkspaceRecord | null> {
  try {
    const headers = await syncAuthHeaders("application/json");
    if (!headers) return null;

    const res = await fetch(workflowUrl("record-signature"), {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { workspace?: TenantWorkspaceRecord };
    if (!json.workspace) return null;

    saveTenantWorkspace(json.workspace);
    return json.workspace;
  } catch {
    return null;
  }
}

export function resolveRequesterPhone(role: Role): string | null {
  const session = getActiveSession();
  if (!session) return null;
  return normalizePhoneDigits(session.phone);
}

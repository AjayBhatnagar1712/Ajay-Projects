export type ReturningTenantAccessKind = "immediate" | "otp" | "blocked";

export type ReturningTenantAccessReason =
  | "active_tenant_session"
  | "upload_session"
  | "account_exists"
  | "new_account"
  | "invalid"
  | "expired";

export interface ReturningTenantAccessDecision {
  kind: ReturningTenantAccessKind;
  reason: ReturningTenantAccessReason;
}

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export function resolveReturningTenantAccess(input: {
  inviteStatus: string;
  tenantPhone: string;
  hasActiveTenantSession: boolean;
  activeTenantPhone?: string;
  hasUploadSession: boolean;
  hasTenantAccount: boolean;
  hasRememberedTenantSession?: boolean;
  rememberedTenantPhone?: string;
}): ReturningTenantAccessDecision {
  if (input.inviteStatus === "expired") {
    return { kind: "blocked", reason: "expired" };
  }
  if (input.inviteStatus === "invalid") {
    return { kind: "blocked", reason: "invalid" };
  }

  const tenantDigits = phoneLast10(input.tenantPhone);
  const sessionDigits = input.activeTenantPhone ? phoneLast10(input.activeTenantPhone) : "";
  const rememberedDigits = input.rememberedTenantPhone
    ? phoneLast10(input.rememberedTenantPhone)
    : "";

  if (
    input.hasActiveTenantSession &&
    sessionDigits.length === 10 &&
    sessionDigits === tenantDigits
  ) {
    return { kind: "immediate", reason: "active_tenant_session" };
  }

  if (
    input.hasRememberedTenantSession &&
    rememberedDigits.length === 10 &&
    rememberedDigits === tenantDigits
  ) {
    return { kind: "immediate", reason: "active_tenant_session" };
  }

  if (input.hasUploadSession) {
    return { kind: "immediate", reason: "upload_session" };
  }

  if (input.hasTenantAccount) {
    return { kind: "otp", reason: "account_exists" };
  }

  return { kind: "otp", reason: "new_account" };
}

export function documentsAlreadySubmittedForInvite(input: {
  status: string;
  tenantDocumentStatus?: string;
}): boolean {
  return (
    input.status === "submitted" || input.tenantDocumentStatus === "documents_submitted"
  );
}

export function shouldOpenDocumentManagement(inviteStatus: string): boolean {
  return inviteStatus === "submitted";
}

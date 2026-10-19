import type { TenantWorkspaceRecord, TenantAgreementSnapshot } from "./tenantWorkspace";
import { getAgreements, type Agreement } from "./agreements";

export type TenantAgreementSender = "owner" | "broker";

export interface TenantAgreementPreviewData {
  agreementDate: string;
  ownerName: string;
  tenantName: string;
  propertyAddress: string;
  propertyType: string;
  propertyArea: string;
  leaseDuration: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: string;
  securityDeposit: string;
  rentDueDay: string;
  lockInPeriod: string;
  noticePeriod: string;
  tenancyParagraph: string;
}

export interface TenantAgreementReviewPresentation {
  sender: TenantAgreementSender;
  feeLabel: string;
  feeCaption: string;
  feeAmount: string;
  nextStepMessage: string;
  ctaLabel: string;
}

export interface TenantTrustLayerPaymentModalCopy {
  title: string;
  description: string;
  ctaLabel: string;
}

export function resolveTenantTrustLayerPaymentModalCopy(
  presentation: TenantAgreementReviewPresentation,
): TenantTrustLayerPaymentModalCopy {
  const feePhrase =
    presentation.sender === "owner"
      ? `security deposit of ${presentation.feeAmount}`
      : `brokerage fee of ${presentation.feeAmount}`;

  return {
    title: "Trustkeyper never takes a cut!",
    description: `The ${feePhrase} is safely held by TrustKeyper and will be refunded if the agreement is not completed or the owner chooses not to proceed.`,
    ctaLabel: "Proceed with payment",
  };
}

export function formatTenantWhatsAppPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone.trim();
  return `+91 ${digits}`;
}

function collectUniqueWhatsAppPhones(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const value of values) {
    if (!value?.trim()) continue;
    const formatted = formatTenantWhatsAppPhoneDisplay(value);
    if (seen.has(formatted)) continue;
    seen.add(formatted);
    phones.push(formatted);
  }
  return phones;
}

function getAgreementTenantContacts(agreementId?: string): string[] {
  if (!agreementId) return [];
  const agreement = getAgreements().find((row) => row.id === agreementId);
  if (!agreement) return [];

  const contacts = [agreement.tenantContact];
  if (agreement.coTenantContact) {
    contacts.push(
      ...agreement.coTenantContact
        .split(",")
        .map((contact) => contact.trim())
        .filter(Boolean),
    );
  }
  return contacts;
}

export function resolveTenantESignWhatsAppPhones(input: {
  workspace: TenantWorkspaceRecord | null;
  sessionPhone?: string;
}): string[] {
  const agreementContacts = getAgreementTenantContacts(input.workspace?.agreementId);
  const phones = collectUniqueWhatsAppPhones([
    ...agreementContacts,
    input.sessionPhone,
    input.workspace?.phone,
  ]);

  if (phones.length > 0) return phones;
  return [formatTenantWhatsAppPhoneDisplay("6369856040")];
}

export interface TenantAgreementESignSentModalCopy {
  title: string;
  description: string;
  ctaLabel: string;
}

export function resolveTenantAgreementDownloadModalCopy(): TenantAgreementESignSentModalCopy {
  return {
    title: "Download your agreement",
    description:
      "Your payment was received. Download the rental agreement, sign it offline, and upload your signed copy from the dashboard.",
    ctaLabel: "Download and go to Dashboard",
  };
}

/** @deprecated Use resolveTenantAgreementDownloadModalCopy — kept for test compatibility */
export function resolveTenantAgreementESignSentModalCopy(): TenantAgreementESignSentModalCopy {
  return resolveTenantAgreementDownloadModalCopy();
}

export function formatAgreementCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function resolveTenantAgreementSender(
  workspace: TenantWorkspaceRecord | null,
): TenantAgreementSender {
  if (workspace?.requesterRole === "owner") return "owner";
  return "broker";
}

export function resolveTenantAgreementReviewPresentation(input: {
  sender: TenantAgreementSender;
  brokerageAmount?: number;
  securityDepositAmount?: number;
}): TenantAgreementReviewPresentation {
  if (input.sender === "owner") {
    const amount = input.securityDepositAmount ?? 56_000;
    const formatted = formatAgreementCurrency(amount);
    return {
      sender: "owner",
      feeLabel: "Security Deposit",
      feeCaption: "Required before your lease is executed",
      feeAmount: formatted,
      nextStepMessage: `You'll need to pay the security deposit of ${formatted} before the agreement is sent for eSigning.`,
      ctaLabel: "Pay the security and esign",
    };
  }

  const amount = input.brokerageAmount ?? 13_000;
  const formatted = formatAgreementCurrency(amount);
  return {
    sender: "broker",
    feeLabel: "Brokerage Fee",
    feeCaption: "Service charge for property & lease facilitation",
    feeAmount: formatted,
    nextStepMessage: `You'll need to pay the brokerage fee of ${formatted} before the agreement is sent for eSigning.`,
    ctaLabel: "Proceed to Pay Brokerage",
  };
}

function findLinkedAgreement(workspace: TenantWorkspaceRecord | null): Agreement | undefined {
  if (!workspace?.agreementId) return undefined;
  return getAgreements().find((row) => row.id === workspace.agreementId);
}

function parseAmount(value?: string): number | undefined {
  if (!value) return undefined;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return amount;
}

function formatAgreementDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function ordSuffix(n: number): string {
  if (n === 1 || n === 21 || n === 31) return "st";
  if (n === 2 || n === 22) return "nd";
  if (n === 3 || n === 23) return "rd";
  return "th";
}

function formatLeaseDate(value?: string): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildTenantAgreementPreviewFromSnapshot(
  snapshot: TenantAgreementSnapshot,
  workspace?: TenantWorkspaceRecord | null,
): TenantAgreementPreviewData {
  const rentDueDayNum = Number(snapshot.rentDueDay);
  const rentDueDayLabel = Number.isFinite(rentDueDayNum)
    ? `${rentDueDayNum}${ordSuffix(rentDueDayNum)}`
    : snapshot.rentDueDay;

  return {
    agreementDate: formatAgreementDate(new Date()),
    ownerName: snapshot.ownerName,
    tenantName: snapshot.tenantName,
    propertyAddress: snapshot.propertyAddress,
    propertyType: snapshot.propertyType ?? workspace?.propertyType ?? "Residential Property",
    propertyArea: "—",
    leaseDuration: snapshot.leaseEndDate ? "Fixed term" : "11 months",
    leaseStartDate: formatLeaseDate(snapshot.leaseStartDate),
    leaseEndDate: formatLeaseDate(snapshot.leaseEndDate),
    monthlyRent: formatAgreementCurrency(parseAmount(snapshot.monthlyRent) ?? 0),
    securityDeposit: formatAgreementCurrency(parseAmount(snapshot.securityDeposit) ?? 0),
    rentDueDay: rentDueDayLabel,
    lockInPeriod: snapshot.lockInPeriod || "—",
    noticePeriod: snapshot.noticePeriod || "—",
    tenancyParagraph:
      snapshot.agreementText?.slice(0, 280) ??
      `The tenancy shall commence on ${formatLeaseDate(snapshot.leaseStartDate)} in accordance with the terms of this agreement.`,
  };
}

export function buildTenantAgreementPreviewFromAgreement(
  agreement: Agreement,
  workspace?: TenantWorkspaceRecord | null,
): TenantAgreementPreviewData {
  const snapshot: TenantAgreementSnapshot = {
    ownerName: agreement.ownerName,
    ownerContact: agreement.ownerContact,
    tenantName: agreement.tenantName,
    propertyAddress: workspace?.propertyAddress ?? agreement.propertyTitle,
    propertyType: workspace?.propertyType,
    leaseStartDate: agreement.startDate,
    leaseEndDate: agreement.endDate,
    monthlyRent: agreement.monthlyRent,
    securityDeposit: agreement.securityDeposit,
    rentDueDay: agreement.rentDueDay,
    lockInPeriod: agreement.lockInPeriod,
    noticePeriod: agreement.noticePeriod,
    brokerageAmount: agreement.brokerageAmount,
    agreementText: agreement.customText,
  };
  return buildTenantAgreementPreviewFromSnapshot(snapshot, workspace);
}

export function buildTenantAgreementPreviewFromWorkspace(
  workspace: TenantWorkspaceRecord | null,
): TenantAgreementPreviewData {
  if (workspace?.agreementSnapshot) {
    return buildTenantAgreementPreviewFromSnapshot(workspace.agreementSnapshot, workspace);
  }

  const agreement = findLinkedAgreement(workspace);
  if (agreement) {
    return buildTenantAgreementPreviewFromAgreement(agreement, workspace);
  }

  const agreementDate = formatAgreementDate(new Date());
  const monthlyRentAmount = parseAmount(workspace?.monthlyRent) ?? 28_000;
  const securityDepositAmount = parseAmount(workspace?.securityDeposit) ?? monthlyRentAmount * 2;
  const rentDueDay = 5;
  const leaseStart = new Date(2026, 1, 1);
  const leaseEnd = new Date(2026, 11, 31);

  const leaseStartLabel = leaseStart.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const leaseEndLabel = leaseEnd.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return {
    agreementDate,
    ownerName: workspace?.ownerName ?? "Rajesh Kumar",
    tenantName: workspace?.tenantName ?? "Karthik M.",
    propertyAddress:
      workspace?.propertyAddress ??
      "Prestige Lakeside Unit 1204, Gachibowli, Hyderabad - 500032",
    propertyType: workspace?.propertyType ?? "3 BHK Apartment",
    propertyArea: "1,450 sq ft",
    leaseDuration: "11 months",
    leaseStartDate: leaseStartLabel,
    leaseEndDate: leaseEndLabel,
    monthlyRent: formatAgreementCurrency(monthlyRentAmount),
    securityDeposit: formatAgreementCurrency(securityDepositAmount),
    rentDueDay: `${rentDueDay}${ordSuffix(rentDueDay)}`,
    lockInPeriod: "6 months",
    noticePeriod: "2 months",
    tenancyParagraph: `The tenancy shall commence on ${leaseStartLabel} and expire on ${leaseEndLabel}, unless renewed or terminated in accordance with the terms herein. Upon expiration, the tenancy may continue on a month-to-month basis subject to mutual consent of both parties.`,
  };
}

export function buildTenantAgreementReviewState(
  workspace: TenantWorkspaceRecord | null,
): {
  preview: TenantAgreementPreviewData;
  presentation: TenantAgreementReviewPresentation;
} {
  const sender = resolveTenantAgreementSender(workspace);
  const agreement = findLinkedAgreement(workspace);
  const monthlyRentAmount = parseAmount(workspace?.monthlyRent ?? agreement?.monthlyRent);
  const securityDepositAmount = parseAmount(
    workspace?.securityDeposit ?? agreement?.securityDeposit,
  );
  const brokerageFromAgreement = parseAmount(agreement?.brokerageAmount);
  const brokerageAmount =
    brokerageFromAgreement ??
    (sender === "broker" && monthlyRentAmount
      ? Math.round(monthlyRentAmount * 0.5)
      : undefined);

  return {
    preview: buildTenantAgreementPreviewFromWorkspace(workspace),
    presentation: resolveTenantAgreementReviewPresentation({
      sender,
      brokerageAmount: brokerageAmount ?? 13_000,
      securityDepositAmount,
    }),
  };
}

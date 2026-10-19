import type { Agreement } from "@/lib/agreements";

export type RentalAgreementInput = {
  propertyTitle: string;
  propertyAddress?: string;
  ownerName: string;
  ownerContact: string;
  additionalOwnerNames?: string;
  tenantName: string;
  tenantContact: string;
  coTenantName?: string;
  coTenantContact?: string;
  startDate: string;
  monthlyRent: string;
  securityDeposit: string;
  lockInPeriod: string;
  noticePeriod: string;
  rentDueDay: string;
  maintenanceCharges?: string;
  brokerageAmount?: string;
  brokeragePaidBy?: string;
  brokerageMode?: string;
  isOwnerFlow?: boolean;
};

function ordSuffix(n: number): string {
  if (n === 1 || n === 21 || n === 31) return "st";
  if (n === 2 || n === 22) return "nd";
  if (n === 3 || n === 23) return "rd";
  return "th";
}

function numberToWords(n: number): string {
  if (n === 0) return "Zero";
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " " + convert(num % 100) : "");
    if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + convert(num % 1000) : "");
    if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + convert(num % 100000) : "");
    return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + convert(num % 10000000) : "");
  }
  return convert(n);
}

function formatDateStr(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function inr(value: string): string {
  const n = Number(value.replace(/\D/g, "") || value);
  if (!n) return "—";
  return `₹${n.toLocaleString("en-IN")} (${numberToWords(n)} only)`;
}

export function generateRentalAgreementText(input: RentalAgreementInput): string {
  const day = input.startDate ? new Date(input.startDate).getDate() : "—";
  const monthYear = input.startDate
    ? new Date(input.startDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "—";

  const maint = input.maintenanceCharges
    ? `₹${Number(input.maintenanceCharges).toLocaleString("en-IN")} per month (payable by the Tenant)`
    : "Included in the monthly rent / not separately charged";

  const brokerageBlock = input.isOwnerFlow
    ? ""
    : `
8. BROKERAGE
   Amount: ${input.brokerageAmount ? inr(input.brokerageAmount) : "Nil"}
   Paid by: ${input.brokeragePaidBy ?? "—"}
   Mode: ${input.brokerageMode ?? "—"}`;

  return `RESIDENTIAL LEAVE AND LICENSE AGREEMENT
(India)

This Leave and License Agreement ("Agreement") is executed on this ${day}${ordSuffix(Number(day) || 0)} day of ${monthYear} at ${input.propertyAddress || input.propertyTitle}.

BETWEEN

LESSOR (Owner/Licensor):
Name: ${input.ownerName || "—"}
Contact: ${input.ownerContact || "—"}
${input.additionalOwnerNames ? `Co-owner(s): ${input.additionalOwnerNames}` : ""}

AND

LICENSEE (Tenant/Licensee):
Name: ${input.tenantName || "—"}
Contact: ${input.tenantContact || "—"}
${input.coTenantName ? `Co-tenant(s): ${input.coTenantName}${input.coTenantContact ? ` (${input.coTenantContact})` : ""}` : ""}

PREMISES
Licensed premises: ${input.propertyTitle}
${input.propertyAddress ? `Address: ${input.propertyAddress}` : ""}

COMMERCIAL TERMS
1. Monthly License Fee (Rent): ${inr(input.monthlyRent)}
2. Interest-free Refundable Deposit: ${inr(input.securityDeposit)}
3. Commencement Date: ${formatDateStr(input.startDate)}
4. Lock-in Period: ${input.lockInPeriod || "As mutually agreed"}
5. Notice Period for termination: ${input.noticePeriod || "One (1) month"}
6. License Fee due date: ${input.rentDueDay ? `${input.rentDueDay}${ordSuffix(Number(input.rentDueDay))} day of every calendar month` : "As agreed"}
7. Maintenance / Society charges: ${maint}${brokerageBlock}

GENERAL CONDITIONS
• The Licensee shall use the premises solely for residential purposes.
• The Licensee shall not sub-license the premises without prior written consent of the Lessor.
• The Licensee shall comply with society/by-law rules and maintain the premises in good condition.
• On expiry or termination, the Licensee shall hand over peaceful vacant possession.
• Any dispute shall be subject to the courts having jurisdiction at the location of the premises.

IN WITNESS WHEREOF the parties agree to the terms above and to execute this Agreement through TrustKeyper e-signing.

---
Generated via TrustKeyper`;
}

export function agreementFromRentalInput(input: RentalAgreementInput): Agreement {
  return {
    id: "draft",
    propertyId: "",
    propertyTitle: input.propertyTitle,
    ownerName: input.ownerName,
    ownerContact: input.ownerContact,
    tenantName: input.tenantName,
    tenantContact: input.tenantContact,
    coTenantName: input.coTenantName,
    coTenantContact: input.coTenantContact,
    startDate: input.startDate,
    monthlyRent: input.monthlyRent,
    securityDeposit: input.securityDeposit,
    lockInPeriod: input.lockInPeriod,
    noticePeriod: input.noticePeriod,
    rentDueDay: input.rentDueDay,
    maintenanceCharges: input.maintenanceCharges,
    brokerageAmount: input.brokerageAmount ?? "0",
    brokeragePaidBy: (input.brokeragePaidBy as Agreement["brokeragePaidBy"]) ?? "Tenant",
    brokerageMode: (input.brokerageMode as Agreement["brokerageMode"]) ?? "Bank Transfer",
    status: "Sent",
    createdAt: Date.now(),
  };
}

export async function buildRentalAgreementPdfBlob(
  input: RentalAgreementInput,
  filename?: string,
): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF } = await import("jspdf");
  const text = generateRentalAgreementText(input);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  const lines = doc.splitTextToSize(text, maxWidth);
  const lineHeight = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("RESIDENTIAL LEAVE AND LICENSE AGREEMENT", margin, y);
  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  const safeName = (filename ?? input.propertyTitle).replace(/[^\w.-]+/g, "_").slice(0, 80);
  const pdfFilename = `Rental_Agreement_${safeName}.pdf`;
  const blob = doc.output("blob");
  return { blob, filename: pdfFilename };
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadRentalAgreementPdf(
  input: RentalAgreementInput,
  filename?: string,
): Promise<void> {
  const { blob, filename: pdfFilename } = await buildRentalAgreementPdfBlob(input, filename);
  triggerBlobDownload(blob, pdfFilename);
}

export type AgreementShareResult = "shared" | "whatsapp" | "download-only";

/** Download PDF, then share message + file together when the device supports it. */
export async function shareRentalAgreementPdf(
  input: RentalAgreementInput,
  propertyTitle: string,
  phone: string,
  whatsAppHref: (phone: string, message: string) => string,
  messageOverride?: string,
): Promise<AgreementShareResult> {
  const message = messageOverride ?? buildAgreementWhatsAppMessage(propertyTitle);
  const { blob, filename } = await buildRentalAgreementPdfBlob(input, propertyTitle);
  triggerBlobDownload(blob, filename);

  const file = new File([blob], filename, { type: "application/pdf" });
  const shareData: ShareData = { text: message, files: [file] };

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare(shareData))
  ) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch {
      /* user dismissed share sheet */
    }
  }

  if (phone) {
    window.open(whatsAppHref(phone, message), "_blank", "noopener,noreferrer");
    return "whatsapp";
  }

  return "download-only";
}

export function buildAgreementWhatsAppMessage(
  propertyTitle: string,
  senderLabel: string = "Owner",
): string {
  return (
    `Hello,\n\n` +
    `Rental agreement for:\n` +
    `${propertyTitle}\n\n` +
    `Sent by ${senderLabel} via TrustKeyper.\n\n` +
    `Please review the attached PDF and confirm your acceptance.\n\n` +
    `Sent via TrustKeyper.`
  );
}

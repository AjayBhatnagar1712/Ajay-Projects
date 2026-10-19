import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Eye,
  Pencil,
  Download,
  Edit,
  PenLine,
  X,
  CheckCircle2,
} from "lucide-react";
import { type Agreement, type AgreementStatus } from "@/lib/agreements";
import { shareRentalAgreementPdf, type RentalAgreementInput } from "@/lib/rentalAgreementDocument";
import { whatsAppInviteHref } from "@/lib/ownerTenants";
import { AgreementSigningInlineActions } from "@/components/agreements/AgreementSigningInlineActions";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateStr(s: string): string {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

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
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
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

export function generateAgreementText(a: Agreement): string {
  const day = a.startDate ? new Date(a.startDate).getDate() : "—";
  const monthYear = a.startDate
    ? new Date(a.startDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "—";

  const rent = a.monthlyRent
    ? `₹${Number(a.monthlyRent).toLocaleString("en-IN")} (${numberToWords(Number(a.monthlyRent))} Only)`
    : "—";
  const deposit = a.securityDeposit
    ? `₹${Number(a.securityDeposit).toLocaleString("en-IN")} (${numberToWords(Number(a.securityDeposit))} Only)`
    : "—";
  const maint = a.maintenanceCharges
    ? `₹${Number(a.maintenanceCharges).toLocaleString("en-IN")}/month (paid by tenant)`
    : "Not included";

  const brokAmt =
    a.brokeragePaidBy === "Both"
      ? "Owner pays — see brokerage section; Tenant pays — see brokerage section"
      : a.brokerageAmount
        ? `₹${Number(a.brokerageAmount).toLocaleString("en-IN")}`
        : "—";

  return `RENTAL AGREEMENT

This Rental Agreement is made on this ${day}${ordSuffix(Number(day))} day of ${monthYear} between:

OWNER: ${a.ownerName || "—"}, residing at ${a.propertyTitle}, ${a.ownerContact ? "Contact: " + a.ownerContact : ""}

AND

TENANT: ${a.tenantName || "—"}${a.tenantContact ? ", Contact: " + a.tenantContact : ""}${a.coTenantName ? "\nCO-TENANT: " + a.coTenantName : ""}

PROPERTY: ${a.propertyTitle}

TERMS:
1. Monthly Rent: ${rent}
2. Security Deposit: ${deposit}
3. Tenure: ${a.lockInPeriod || "—"} from ${formatDateStr(a.startDate)}
4. Maintenance: ${maint}
5. Notice Period: ${a.noticePeriod || "—"}
6. Rent due on: ${a.rentDueDay ? a.rentDueDay + ordSuffix(Number(a.rentDueDay)) + " of each month" : "—"}

BROKERAGE:
Brokerage Amount: ${brokAmt}
Paid by: ${a.brokeragePaidBy}
Payment Mode: ${a.brokerageMode}

This agreement is legally binding and subject to the terms and conditions agreed upon by both parties. Any dispute arising out of this agreement shall be subject to the jurisdiction of local courts.

This agreement will be executed through a legally valid e-signing process powered by TrustKeyper E-Sign.`;
}

export function buildAgreementEditDraft(agr: Agreement) {
  const tenants = [
    { name: agr.tenantName, contact: agr.tenantContact },
    ...(agr.coTenantName
      ? agr.coTenantName.split(", ").map((name, i) => ({
          name,
          contact: agr.coTenantContact?.split(", ")[i] || "",
        }))
      : []),
  ].filter((t) => t.name);

  return {
    agreementId: agr.id,
    propertyId: agr.propertyId,
    ownerName: agr.ownerName,
    ownerContact: agr.ownerContact,
    additionalOwners: [] as { name: string; contact: string }[],
    selectedTenants: tenants,
    startDate: agr.startDate,
    monthlyRent: agr.monthlyRent,
    securityDeposit: agr.securityDeposit,
    lockInPeriod: agr.lockInPeriod,
    noticePeriod: agr.noticePeriod,
    rentDueDay: agr.rentDueDay,
    maintenanceCharges: agr.maintenanceCharges || "",
    brokerageAmount: agr.brokerageAmount,
    brokerageAmountOwner: "",
    brokerageAmountTenant: "",
    brokeragePaidBy: agr.brokeragePaidBy,
    brokerageMode: agr.brokerageMode === "Cash" ? "Bank Transfer" : agr.brokerageMode,
  };
}

function StatusBadge({ status }: { status: AgreementStatus }) {
  if (status === "Sent") {
    return null;
  }
  if (status === "Signed") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full whitespace-nowrap">
        <CheckCircle2 size={11} />
        Signed
      </span>
    );
  }
  if (status === "Expired") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full whitespace-nowrap">
        Expired
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full whitespace-nowrap">
      Draft
    </span>
  );
}

export function AgreementViewModal({ agreement, onClose }: { agreement: Agreement; onClose: () => void }) {
  const text = agreement.customText ?? generateAgreementText(agreement);

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rental_Agreement_${agreement.propertyTitle.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <FileText size={18} className="text-primary" />
            <h2 className="text-base font-semibold text-gray-900">
              Rental Agreement – {agreement.propertyTitle}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <pre className="text-xs text-gray-700 font-mono leading-relaxed whitespace-pre-wrap">{text}</pre>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="h-9 px-5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Close
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="h-9 px-5 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgreementEditManuallyModal({
  agreement,
  onClose,
  onSave,
}: {
  agreement: Agreement;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(agreement.customText ?? generateAgreementText(agreement));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <PenLine size={16} className="text-primary" />
              <h2 className="text-base font-semibold text-gray-900">Edit Agreement</h2>
            </div>
            <p className="text-xs text-gray-400 ml-6">
              Make minor changes to the agreement text directly. For major changes, use Edit Details.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-4 shrink-0">
            <X size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden px-6 py-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full min-h-[320px] resize-none text-xs font-mono text-gray-800 leading-relaxed border border-gray-200 rounded-xl p-4 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            spellCheck={false}
          />
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="h-9 px-5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                window.sessionStorage.setItem("agreement_needs_resend", agreement.id);
              } catch {
                /* ignore */
              }
              onSave(text);
              onClose();
            }}
            className="h-9 px-5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export function AgreementDocumentRow({
  agreement,
  onView,
  onEditManually,
  onEditDetails,
  requesterRole,
}: {
  agreement: Agreement;
  onView: () => void;
  onEditManually: () => void;
  onEditDetails: () => void;
  requesterRole?: "owner" | "broker";
}) {
  const isNew = Date.now() - agreement.createdAt < 24 * 60 * 60 * 1000;
  const [dropOpen, setDropOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const recentlyEdited =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("agreement_needs_resend") === agreement.id;

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropOpen]);

  const updateMenuPosition = useCallback(() => {
    const btn = editBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 160;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
  }, []);

  const toggleDropOpen = () => {
    setDropOpen((open) => {
      if (open) return false;
      updateMenuPosition();
      return true;
    });
  };

  useEffect(() => {
    if (!dropOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    const onScrollOrResize = () => setDropOpen(false);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [dropOpen, updateMenuPosition]);

  const handleDownload = () => {
    const text = agreement.customText ?? generateAgreementText(agreement);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rental_Agreement_${agreement.propertyTitle.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResend = async () => {
    const input: RentalAgreementInput = {
      propertyTitle: agreement.propertyTitle,
      ownerName: agreement.ownerName,
      ownerContact: agreement.ownerContact,
      additionalOwnerNames: "",
      tenantName: agreement.tenantName,
      tenantContact: agreement.tenantContact,
      coTenantName: agreement.coTenantName ?? "",
      coTenantContact: agreement.coTenantContact ?? "",
      startDate: agreement.startDate,
      monthlyRent: agreement.monthlyRent,
      securityDeposit: agreement.securityDeposit,
      lockInPeriod: agreement.lockInPeriod,
      noticePeriod: agreement.noticePeriod,
      rentDueDay: agreement.rentDueDay,
      maintenanceCharges: agreement.maintenanceCharges ?? "",
      brokerageAmount: agreement.brokerageAmount,
      brokeragePaidBy: agreement.brokeragePaidBy,
      brokerageMode: agreement.brokerageMode,
      isOwnerFlow: true,
    };
    const senderLabel = agreement.ownerName?.trim() ? agreement.ownerName.trim() : "Owner";
    const msg =
      `Rental agreement for:\n` +
      `${agreement.propertyTitle}\n\n` +
      `Sent by ${senderLabel} via TrustKeyper.\n\n` +
      `Please review the attached PDF.`;
    await shareRentalAgreementPdf(input, agreement.propertyTitle, "", whatsAppInviteHref, msg);
  };

  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5 hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl overflow-visible min-w-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <FileText size={17} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-semibold text-gray-900 break-words sm:truncate">
              Rental Agreement – {agreement.propertyTitle}
            </p>
            {isNew ? (
              <span className="text-[10px] font-semibold text-primary bg-blue-50 border border-primary/20 px-1.5 py-0.5 rounded shrink-0">
                NEW
              </span>
            ) : null}
            <StatusBadge status={agreement.status} />
          </div>
          <p className="text-xs text-gray-400 mt-1 break-words">
            Agreement · {formatDate(agreement.createdAt)}
          </p>
          {requesterRole ? (
            <div className="mt-2">
              <AgreementSigningInlineActions agreement={agreement} requesterRole={requesterRole} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 pl-12 sm:pl-0">
        {recentlyEdited ? (
          <button
            type="button"
            onClick={handleResend}
            className="h-8 px-3 rounded-lg border border-primary text-primary text-xs font-semibold hover:bg-primary/5 transition-colors shrink-0"
            title="Resend agreement"
          >
            Resend agreement
          </button>
        ) : null}
        <div className="flex items-center gap-1 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={onView}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-primary bg-blue-50 hover:bg-primary hover:text-white transition-colors cursor-pointer"
            title="View"
            aria-label={`View agreement for ${agreement.propertyTitle}`}
          >
            <Eye size={15} />
          </button>
          <div ref={dropRef} className="relative">
            <button
              ref={editBtnRef}
              type="button"
              onClick={toggleDropOpen}
              aria-expanded={dropOpen}
              aria-haspopup="menu"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${dropOpen ? "bg-primary text-white" : "text-primary bg-blue-50 hover:bg-primary hover:text-white"}`}
              title="Edit"
              aria-label={`Edit agreement for ${agreement.propertyTitle}`}
            >
              <Pencil size={15} />
            </button>
            {dropOpen && menuPos
              ? createPortal(
                  <div
                    className="fixed bg-white rounded-xl border border-gray-200 shadow-lg z-[100] py-1 min-w-[160px]"
                    style={{ top: menuPos.top, left: menuPos.left }}
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setDropOpen(false); onEditDetails(); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors"
                    >
                      <Edit size={13} /> Edit Details
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setDropOpen(false); onEditManually(); }}
                      className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-primary transition-colors"
                    >
                      <PenLine size={13} /> Edit Manually
                    </button>
                  </div>,
                  document.body,
                )
              : null}
          </div>
          <button
            type="button"
            onClick={handleDownload}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-primary bg-blue-50 hover:bg-primary hover:text-white transition-colors cursor-pointer"
            title="Download"
            aria-label={`Download agreement for ${agreement.propertyTitle}`}
          >
            <Download size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

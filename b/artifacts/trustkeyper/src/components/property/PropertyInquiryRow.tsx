import React from "react";
import { FaWhatsapp } from "react-icons/fa";
import {
  formatMemberContact,
  getInquiryWhatsAppHref,
  updatePropertyInquiryLeadStatus,
  type OwnerTenantInquiry,
  type PropertyInquiryLeadStatus,
} from "@/lib/ownerTenants";
import type { PropertyShareSource } from "@/lib/propertyShareView";

const LEAD_STATUS_LABELS: Record<PropertyInquiryLeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  rejected: "Rejected",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function formatInquiryDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function LeadStatusBadge({ status }: { status: PropertyInquiryLeadStatus }) {
  const className =
    status === "new"
      ? "bg-blue-100 text-blue-800 border-blue-200"
      : status === "contacted"
        ? "bg-amber-100 text-amber-800 border-amber-200"
        : status === "converted"
          ? "bg-green-100 text-green-800 border-green-200"
          : "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${className}`}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}

export function PropertyInquiryRow({
  inquiry,
  recipientRole,
  onUpdate,
}: {
  inquiry: OwnerTenantInquiry;
  recipientRole: PropertyShareSource;
  onUpdate: () => void;
}) {
  const whatsAppUrl = getInquiryWhatsAppHref(inquiry);
  const leadStatus = inquiry.leadStatus ?? "new";

  const handleStatusChange = (next: PropertyInquiryLeadStatus) => {
    updatePropertyInquiryLeadStatus(inquiry.id, next, recipientRole);
    onUpdate();
  };

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4 min-w-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
          {getInitials(inquiry.name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-[15px] truncate">{inquiry.name}</p>
            <LeadStatusBadge status={leadStatus} />
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{formatMemberContact(inquiry.phone)}</p>
          <p className="text-xs text-gray-500 mt-1 leading-snug">For {inquiry.propertyLabel}</p>
          <p className="text-xs text-gray-400 mt-1">Inquired {formatInquiryDate(inquiry.createdAt)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:items-end gap-2 shrink-0">
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-10 px-4 rounded-[4px] text-sm font-semibold border border-green-600 text-green-700 bg-white hover:bg-green-50 transition-colors inline-flex items-center justify-center gap-2"
        >
          <FaWhatsapp className="w-4 h-4 shrink-0 text-[#25D366]" aria-hidden />
          Chat
        </a>
        <select
          value={leadStatus}
          onChange={(e) => handleStatusChange(e.target.value as PropertyInquiryLeadStatus)}
          className="h-9 text-xs border border-gray-200 rounded-[4px] px-2 text-gray-700 bg-white"
          aria-label={`Update status for ${inquiry.name}`}
        >
          {(Object.keys(LEAD_STATUS_LABELS) as PropertyInquiryLeadStatus[]).map((key) => (
            <option key={key} value={key}>
              {LEAD_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

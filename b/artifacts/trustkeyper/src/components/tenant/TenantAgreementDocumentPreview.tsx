import type { ReactNode } from "react";
import type { TenantAgreementPreviewData } from "@/lib/tenantAgreementReview";

function DetailBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-2">{label}</p>
      <div className="text-sm text-gray-800 leading-relaxed space-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold text-gray-900">{label}: </span>
      <span>{value}</span>
    </p>
  );
}

export function TenantAgreementDocumentPreview({ agreement }: { agreement: TenantAgreementPreviewData }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="max-h-[min(72vh,900px)] overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
        <h2 className="text-center text-base sm:text-lg font-bold tracking-[0.2em] text-gray-900 mb-6">
          RENTAL AGREEMENT
        </h2>

        <p className="text-sm text-gray-700 mb-5">
          This agreement made on <span className="font-semibold text-gray-900">{agreement.agreementDate}</span>{" "}
          between:
        </p>

        <div className="space-y-4">
          <DetailBlock label="Owner (First Party)">
            <DetailRow label="Name" value={agreement.ownerName} />
          </DetailBlock>

          <DetailBlock label="Tenant (Second Party)">
            <DetailRow label="Name" value={agreement.tenantName} />
          </DetailBlock>

          <DetailBlock label="Property Details">
            <DetailRow label="Address" value={agreement.propertyAddress} />
            <DetailRow label="Type" value={agreement.propertyType} />
            <DetailRow label="Area" value={agreement.propertyArea} />
          </DetailBlock>

          <DetailBlock label="Lease Terms">
            <DetailRow label="Duration" value={agreement.leaseDuration} />
            <DetailRow
              label="Start / End"
              value={`${agreement.leaseStartDate} to ${agreement.leaseEndDate}`}
            />
            <DetailRow label="Monthly Rent" value={agreement.monthlyRent} />
            <DetailRow label="Security Deposit" value={agreement.securityDeposit} />
            <DetailRow label="Rent Due" value={`${agreement.rentDueDay} of each month`} />
            <DetailRow label="Lock-in" value={agreement.lockInPeriod} />
            <DetailRow label="Notice period" value={agreement.noticePeriod} />
          </DetailBlock>

          <DetailBlock label="Term of Tenancy">
            <p>{agreement.tenancyParagraph}</p>
          </DetailBlock>
        </div>
      </div>
    </div>
  );
}

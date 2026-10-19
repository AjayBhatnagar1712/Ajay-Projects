import { Eye } from "lucide-react";
import { TenantKycStatusBadge } from "@/components/tenant/TenantKycStatusBadge";
import type { TenantDocumentTableRow } from "@/lib/tenantDocuments";

export interface TenantDocumentsTableCardProps {
  rows: TenantDocumentTableRow[];
  loading?: boolean;
  viewingId?: string | null;
  onView?: (row: TenantDocumentTableRow) => void;
}

export function TenantDocumentsTableCard({
  rows,
  loading,
  viewingId,
  onView,
}: TenantDocumentsTableCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 animate-pulse min-h-[220px]">
        <div className="h-6 bg-gray-100 rounded w-1/4 mb-4" />
        <div className="h-12 bg-gray-100 rounded mb-2" />
        <div className="h-16 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white overflow-hidden shadow-[0px_12px_32px_-8px_rgba(25,27,35,0.06)]">
      <div className="px-6 sm:px-8 py-4 border-b border-gray-100">
        <h2 className="text-xl text-[#161b3d]">Uploaded Documents</h2>
        <p className="text-sm text-[#40566d] mt-1 tracking-wide">
          Review document status and open uploaded files.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-primary/[0.09] border-t border-[rgba(108,132,157,0.18)]">
              {["Document", "Details", "Uploaded On", "Status", "Action"].map((heading) => (
                <th
                  key={heading}
                  className="h-[50px] px-4 text-left font-normal text-[#40566d] tracking-wide border-r border-primary/15 last:border-r-0"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[rgba(108,132,157,0.18)]">
                <td className="h-[68px] px-4 text-[#192839] tracking-wide border-r border-primary/15">
                  {row.documentLabel}
                </td>
                <td className="h-[68px] px-4 text-[#40566d] tracking-wide border-r border-primary/15 max-w-[220px]">
                  <span className="line-clamp-2">{row.detailsLabel}</span>
                </td>
                <td className="h-[68px] px-4 text-[#192839] tracking-wide border-r border-primary/15 whitespace-nowrap">
                  {row.uploadedOnLabel}
                </td>
                <td className="h-[68px] px-4 border-r border-primary/15">
                  <TenantKycStatusBadge status={row.verification} />
                </td>
                <td className="h-[68px] px-4">
                  {row.canView ? (
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        aria-label={`View ${row.documentLabel}`}
                        className="w-10 h-10 rounded-full bg-primary/[0.09] text-primary flex items-center justify-center hover:bg-primary/15 transition-colors disabled:opacity-50"
                        disabled={viewingId === row.id}
                        onClick={() => onView?.(row)}
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[#768ea7] text-center block">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

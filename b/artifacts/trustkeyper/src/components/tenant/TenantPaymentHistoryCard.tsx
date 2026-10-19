import { ChevronDown, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TenantRentPaymentHistoryRow } from "@/lib/tenantRentPayments";

export interface TenantPaymentHistoryCardProps {
  rows: TenantRentPaymentHistoryRow[];
  loading?: boolean;
  hasMore?: boolean;
  onDownloadAll?: () => void;
  onViewReceipt?: (rowId: string) => void;
  onDownloadReceipt?: (rowId: string) => void;
  onViewAllActivity?: () => void;
}

export function TenantPaymentHistoryCard({
  rows,
  loading,
  hasMore,
  onDownloadAll,
  onViewReceipt,
  onDownloadReceipt,
  onViewAllActivity,
}: TenantPaymentHistoryCardProps) {
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
    <div className="rounded-2xl bg-white overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 sm:px-8 py-4 border-b border-gray-100">
        <h2 className="text-xl text-[#161b3d]">Payment History</h2>
        {rows.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto p-0 text-primary font-normal text-base hover:bg-transparent hover:underline gap-2"
            onClick={onDownloadAll}
          >
            <Download size={16} />
            Download all receipts
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="px-6 sm:px-8 py-16 text-center">
          <p className="text-base font-medium text-[#192839]">No payments yet</p>
          <p className="text-sm text-[#6b7280] mt-1">
            When you pay rent, your payment history will show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="bg-primary/[0.09] border-t border-[rgba(108,132,157,0.18)]">
                  {["Month", "Amount", "Paid On", "Payment Mode", "Status", "Receipt"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="h-[50px] px-4 text-left font-normal text-[#40566d] tracking-wide border-r border-primary/15 last:border-r-0"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-[rgba(108,132,157,0.18)]">
                    <td className="h-[68px] px-4 text-[#192839] tracking-wide border-r border-primary/15">
                      {row.monthLabel}
                    </td>
                    <td className="h-[68px] px-4 font-bold text-[#192839] tracking-wide border-r border-primary/15">
                      {row.amountLabel}
                    </td>
                    <td className="h-[68px] px-4 text-[#192839] tracking-wide border-r border-primary/15">
                      {row.paidOnLabel}
                    </td>
                    <td className="h-[68px] px-4 text-[#192839] tracking-wide border-r border-primary/15">
                      {row.paymentMode}
                    </td>
                    <td className="h-[68px] px-4 text-[#192839] tracking-wide border-r border-primary/15">
                      {row.statusLabel}
                    </td>
                    <td className="h-[68px] px-4">
                      <div className="flex items-center justify-center gap-6">
                        <button
                          type="button"
                          aria-label={`View receipt for ${row.monthLabel}`}
                          className="w-10 h-10 rounded-full bg-primary/[0.09] text-primary flex items-center justify-center hover:bg-primary/15 transition-colors"
                          onClick={() => onViewReceipt?.(row.id)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Download receipt for ${row.monthLabel}`}
                          className="w-10 h-10 rounded-full bg-primary/[0.09] text-primary flex items-center justify-center hover:bg-primary/15 transition-colors"
                          onClick={() => onDownloadReceipt?.(row.id)}
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore ? (
            <div className="border-t border-[rgba(108,132,157,0.18)] px-4 py-4 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                className="text-primary font-medium text-sm gap-1 hover:bg-primary/5"
                onClick={onViewAllActivity}
              >
                View All Activity
                <ChevronDown size={16} />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

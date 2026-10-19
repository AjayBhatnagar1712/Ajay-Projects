import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import OwnerLayout from "@/components/OwnerLayout";
import { Button } from "@/components/ui/button";
import { formatPaiseToInr } from "@/lib/formatMoney";
import {
  fetchOwnerPaymentHistory,
  summarizeOwnerSettlements,
  type OwnerPaymentRow,
} from "@/lib/ownerPaymentHistory";
import {
  formatPaidAtLabel,
  formatPaymentMethodLabel,
  formatRentPeriodLabel,
  formatStatusLabel,
} from "@/lib/tenantRentPayments";

export default function OwnerFinances() {
  const [payments, setPayments] = useState<OwnerPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOwnerPaymentHistory();
    if (!result.ok) {
      setPayments([]);
      setError("Couldn't load payment history");
      setLoading(false);
      return;
    }
    setPayments(result.payments);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const summary = useMemo(() => summarizeOwnerSettlements(payments), [payments]);

  return (
    <OwnerLayout>
      <div className="p-6 sm:p-10 max-w-[1200px] mx-auto space-y-7">
        <div>
          <h1 className="text-[28px] font-semibold text-primary tracking-tight">Finances</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Rent payments received from your tenants, including settlement split.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-3 items-start">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 px-3 text-sm border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => void loadHistory()}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
              <div className="h-24 rounded-xl bg-gray-100" />
              <div className="h-24 rounded-xl bg-gray-100" />
            </div>
            <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-white p-5 shadow-sm border border-primary/10">
                <p className="text-sm text-[#40566d] tracking-wide">Received this month</p>
                <p className="text-[32px] font-bold leading-none text-[#191b23] tracking-tight mt-2">
                  {formatPaiseToInr(summary.thisMonthPaise)}
                </p>
              </div>
              <div className="rounded-xl bg-white p-5 shadow-sm border border-primary/10">
                <p className="text-sm text-[#40566d] tracking-wide">Received all time</p>
                <p className="text-[32px] font-bold leading-none text-[#191b23] tracking-tight mt-2">
                  {formatPaiseToInr(summary.allTimePaise)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-white overflow-hidden shadow-sm border border-primary/10">
              <div className="px-6 sm:px-8 py-4 border-b border-gray-100">
                <h2 className="text-xl text-[#161b3d]">Payments received</h2>
              </div>

              {payments.length === 0 ? (
                <div className="px-6 sm:px-8 py-16 text-center">
                  <p className="text-base font-medium text-[#192839]">No payments received yet.</p>
                  <p className="text-sm text-[#6b7280] mt-1">
                    When tenants pay rent, settlements will show up here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-sm">
                    <thead>
                      <tr className="bg-primary/[0.09] border-t border-[rgba(108,132,157,0.18)]">
                        {[
                          "Month",
                          "Gross",
                          "You Received",
                          "Platform Fee",
                          "Paid On",
                          "Method",
                          "Status",
                        ].map((heading) => (
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
                      {payments.map((row) => {
                        const transferFailed = Boolean(row.transferFailedAt);
                        return (
                          <tr
                            key={row.id}
                            className="border-t border-[rgba(108,132,157,0.18)] align-top"
                          >
                            <td className="h-[68px] px-4 py-3 text-[#192839] tracking-wide border-r border-primary/15">
                              {formatRentPeriodLabel(row.rentPeriod)}
                            </td>
                            <td className="h-[68px] px-4 py-3 font-bold text-[#192839] tracking-wide border-r border-primary/15">
                              {formatPaiseToInr(row.amountPaise)}
                            </td>
                            <td className="h-[68px] px-4 py-3 font-bold text-[#192839] tracking-wide border-r border-primary/15">
                              {formatPaiseToInr(row.ownerSettlementPaise)}
                            </td>
                            <td className="h-[68px] px-4 py-3 text-[#192839] tracking-wide border-r border-primary/15">
                              {formatPaiseToInr(row.commissionPaise)}
                            </td>
                            <td className="h-[68px] px-4 py-3 text-[#192839] tracking-wide border-r border-primary/15">
                              {formatPaidAtLabel(row.paidAt)}
                            </td>
                            <td className="h-[68px] px-4 py-3 text-[#192839] tracking-wide border-r border-primary/15">
                              {formatPaymentMethodLabel(row.paymentMethod)}
                            </td>
                            <td className="h-[68px] px-4 py-3 tracking-wide">
                              <div className="flex flex-col gap-2">
                                <span className="text-[#192839]">{formatStatusLabel(row.status)}</span>
                                {transferFailed ? (
                                  <span className="inline-flex w-fit items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 border border-red-200">
                                    Transfer failed — contact support
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </OwnerLayout>
  );
}

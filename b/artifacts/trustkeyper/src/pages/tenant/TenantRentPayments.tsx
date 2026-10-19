import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import TenantLayout from "@/components/TenantLayout";
import { TenantMonthlyStatementCard } from "@/components/tenant/TenantMonthlyStatementCard";
import { TenantPaymentHistoryCard } from "@/components/tenant/TenantPaymentHistoryCard";
import { TenantRentBackLink } from "@/components/tenant/TenantRentBackLink";
import { TenantRentExtensionModal } from "@/components/tenant/TenantRentExtensionModal";
import { TenantRentPaymentReceiptModal } from "@/components/tenant/TenantRentPaymentReceiptModal";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  computeCurrentRentPeriod,
  createTenantRentOrder,
  fetchTenantPaymentHistory,
  openRazorpayCheckout,
} from "@/lib/tenantRentPayment";
import {
  buildTenantRentPaymentReceipt,
  buildTenantRentPaymentsSnapshot,
  findRentPaymentHistoryRow,
  mapTenantPaymentRowToHistoryRow,
  type TenantRentPaymentHistoryRow,
  type TenantRentPaymentReceipt,
  type TenantRentPaymentsSnapshot,
} from "@/lib/tenantRentPayments";
import { getActiveTenantWorkspace } from "@/lib/tenantWorkspace";

export default function TenantRentPayments() {
  const [snapshot, setSnapshot] = useState<TenantRentPaymentsSnapshot | null>(null);
  const [workspace, setWorkspace] = useState<ReturnType<typeof getActiveTenantWorkspace>>(null);
  const [historyRows, setHistoryRows] = useState<TenantRentPaymentHistoryRow[]>([]);
  const [statementLoading, setStatementLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TenantRentPaymentReceipt | null>(null);
  const [extensionOpen, setExtensionOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const loadStatement = useCallback(() => {
    try {
      const activeWorkspace = getActiveTenantWorkspace();
      setWorkspace(activeWorkspace);
      setSnapshot(buildTenantRentPaymentsSnapshot(activeWorkspace));
    } catch {
      setSnapshot(buildTenantRentPaymentsSnapshot(null));
    } finally {
      setStatementLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    const result = await fetchTenantPaymentHistory();
    if (!result.ok) {
      setHistoryRows([]);
      setHistoryError("Couldn't load payment history");
      setHistoryLoading(false);
      return;
    }
    setHistoryRows(result.payments.map(mapTenantPaymentRowToHistoryRow));
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    loadStatement();
    void loadHistory();
  }, [loadStatement, loadHistory]);

  const showPlaceholderToast = (title: string) => {
    toast({
      title,
      description: "This action will be connected to payments in a later release.",
    });
  };

  const handleViewReceipt = (rowId: string) => {
    const row = findRentPaymentHistoryRow(historyRows, rowId);
    if (!row) return;
    setReceipt(buildTenantRentPaymentReceipt(workspace, row));
  };

  const handlePayNow = useCallback(async () => {
    const activeWorkspace = getActiveTenantWorkspace();
    if (!activeWorkspace?.agreementId) {
      toast({
        title: "No active agreement found",
        description: "We could not find an agreement linked to your account.",
        variant: "destructive",
      });
      return;
    }

    setPaying(true);
    try {
      const rentPeriod = computeCurrentRentPeriod();
      const order = await createTenantRentOrder({
        agreementId: activeWorkspace.agreementId,
        rentPeriod,
      });

      if (!order.ok) {
        toast({
          title: order.fallbackWithoutGateway ? "Payments aren't enabled yet" : "Could not start payment",
          description: order.fallbackWithoutGateway
            ? "Payment gateway is not configured for this environment."
            : order.error,
          variant: "destructive",
        });
        return;
      }

      const paid = await openRazorpayCheckout(order.checkout);
      if (!paid.ok) {
        toast({
          title: "Payment not completed",
          description: paid.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Payment successful",
        description: "It may take a moment to reflect.",
      });
      void loadHistory();
    } finally {
      setPaying(false);
    }
  }, [loadHistory]);

  const fallbackSnapshot = buildTenantRentPaymentsSnapshot(null);

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-7">
        <TenantRentBackLink />

        <TenantMonthlyStatementCard
          snapshot={snapshot ?? fallbackSnapshot}
          loading={statementLoading}
          payNowLoading={paying}
          onRequestExtension={() => setExtensionOpen(true)}
          onPayNow={() => void handlePayNow()}
        />

        {historyError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="flex gap-3 items-start">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{historyError}</p>
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

        <TenantPaymentHistoryCard
          rows={historyRows}
          loading={historyLoading}
          hasMore={false}
          onDownloadAll={() => showPlaceholderToast("Download all receipts")}
          onViewReceipt={handleViewReceipt}
          onDownloadReceipt={() => showPlaceholderToast("Download receipt")}
          onViewAllActivity={() => showPlaceholderToast("View all activity")}
        />
      </div>

      <TenantRentPaymentReceiptModal
        open={receipt !== null}
        receipt={receipt}
        onClose={() => setReceipt(null)}
      />

      <TenantRentExtensionModal
        open={extensionOpen}
        currentDueDateLabel={snapshot?.currentDueDateLabel ?? fallbackSnapshot.currentDueDateLabel}
        minimumExtensionDate={
          snapshot?.minimumExtensionDate ?? fallbackSnapshot.minimumExtensionDate
        }
        onClose={() => setExtensionOpen(false)}
        onSubmitted={() => {
          toast({
            title: "Extension request submitted",
            description: "Your owner will review this request and respond shortly.",
          });
        }}
      />
    </TenantLayout>
  );
}

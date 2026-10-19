import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import TenantLayout from "@/components/TenantLayout";
import { TenantAgreementDownloadModal } from "@/components/tenant/TenantAgreementESignSentModal";
import { TenantAgreementReviewView } from "@/components/tenant/TenantAgreementReviewView";
import { TenantTrustLayerPaymentModal } from "@/components/tenant/TenantTrustLayerPaymentModal";
import { buildTenantAgreementReviewState } from "@/lib/tenantAgreementReview";
import {
  downloadRentalAgreementPdf,
  type RentalAgreementInput,
} from "@/lib/rentalAgreementDocument";
import { getAgreements } from "@/lib/agreements";
import {
  getActiveTenantWorkspace,
  saveTenantWorkspace,
  type TenantWorkspaceRecord,
} from "@/lib/tenantWorkspace";
import { createTenantEscrowOrder, openRazorpayCheckout } from "@/lib/tenantEscrowPayment";
import { patchTenantWorkspaceOnServer, pullTenantWorkspaceFromServer } from "@/lib/tenantWorkflowServer";

export default function TenantAgreementReview() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trustLayerOpen, setTrustLayerOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState(() => buildTenantAgreementReviewState(null));
  const [workspace, setWorkspace] = useState<TenantWorkspaceRecord | null>(() =>
    getActiveTenantWorkspace(),
  );

  const loadReview = useCallback(() => {
    try {
      const nextWorkspace = getActiveTenantWorkspace();
      setWorkspace(nextWorkspace);
      setReviewState(buildTenantAgreementReviewState(nextWorkspace));
      setLoadError(null);
    } catch {
      setLoadError("Could not load your agreement. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void pullTenantWorkspaceFromServer().finally(() => loadReview());
  }, [loadReview]);

  const rentalInput = useMemo((): RentalAgreementInput | null => {
    if (!workspace) return null;
    const agreement = workspace.agreementId
      ? getAgreements().find((row) => row.id === workspace.agreementId)
      : undefined;
    const snapshot = workspace.agreementSnapshot;
    if (!agreement && !snapshot) return null;

    return {
      propertyTitle: workspace.propertyLabel,
      propertyAddress: workspace.propertyAddress ?? snapshot?.propertyAddress,
      ownerName: snapshot?.ownerName ?? agreement?.ownerName ?? workspace.ownerName ?? "",
      ownerContact: snapshot?.ownerContact ?? agreement?.ownerContact ?? workspace.ownerContact ?? "",
      tenantName: snapshot?.tenantName ?? agreement?.tenantName ?? workspace.tenantName,
      tenantContact: agreement?.tenantContact ?? workspace.phone,
      coTenantName: agreement?.coTenantName,
      coTenantContact: agreement?.coTenantContact,
      startDate: snapshot?.leaseStartDate ?? agreement?.startDate ?? "",
      monthlyRent: snapshot?.monthlyRent ?? agreement?.monthlyRent ?? workspace.monthlyRent ?? "",
      securityDeposit:
        snapshot?.securityDeposit ?? agreement?.securityDeposit ?? workspace.securityDeposit ?? "",
      lockInPeriod: snapshot?.lockInPeriod ?? agreement?.lockInPeriod ?? "",
      noticePeriod: snapshot?.noticePeriod ?? agreement?.noticePeriod ?? "",
      rentDueDay: snapshot?.rentDueDay ?? agreement?.rentDueDay ?? "",
      maintenanceCharges: agreement?.maintenanceCharges,
      brokerageAmount: snapshot?.brokerageAmount ?? agreement?.brokerageAmount,
      brokeragePaidBy: agreement?.brokeragePaidBy,
      brokerageMode: agreement?.brokerageMode,
      isOwnerFlow: workspace.requesterRole === "owner",
    };
  }, [workspace]);

  const handleProceed = () => {
    setPaymentError(null);
    setTrustLayerOpen(true);
  };

  const advanceToDownloadStage = useCallback(
    async (patch?: Partial<TenantWorkspaceRecord>) => {
      const current = getActiveTenantWorkspace();
      if (!current) return;
      const next: TenantWorkspaceRecord = {
        ...current,
        ...patch,
        lifecycleStage: "esign_document_upload",
        updatedAt: Date.now(),
      };
      saveTenantWorkspace(next);
      setWorkspace(next);
      await patchTenantWorkspaceOnServer({
        phone: next.phone,
        lifecycleStage: "esign_document_upload",
        escrowPaymentId: patch?.escrowPaymentId,
        escrowPaymentStatus: patch?.escrowPaymentStatus,
      });
      setTrustLayerOpen(false);
      setDownloadOpen(true);
    },
    [],
  );

  const handleProceedWithPayment = async () => {
    if (!workspace?.agreementId) {
      setPaymentError("Agreement is not linked yet. Please refresh and try again.");
      return;
    }

    setPaying(true);
    setPaymentError(null);
    try {
      const order = await createTenantEscrowOrder({
        agreementId: workspace.agreementId,
        paymentType:
          workspace.preSigningEscrowType ??
          (workspace.requesterRole === "owner" ? "security_deposit" : "brokerage_tenant"),
      });

      if (!order.ok) {
        if (order.fallbackWithoutGateway) {
          await advanceToDownloadStage();
          return;
        }
        setPaymentError(order.error);
        return;
      }

      const paid = await openRazorpayCheckout({
        orderId: order.checkout.orderId,
        amount: order.checkout.amount,
        currency: order.checkout.currency,
        keyId: order.checkout.keyId,
        description:
          order.checkout.paymentType === "security_deposit"
            ? "Security deposit (held in trust)"
            : order.checkout.paymentType === "brokerage_tenant"
              ? "Brokerage fee (held in trust)"
              : "Payment",
      });
      if (!paid.ok) {
        setPaymentError(paid.error);
        return;
      }

      await advanceToDownloadStage({
        escrowPaymentId: order.checkout.rentPaymentId,
        escrowPaymentStatus: "paid",
      });
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadAgreement = useCallback(async () => {
    if (!rentalInput) return;
    setDownloading(true);
    try {
      await downloadRentalAgreementPdf(rentalInput, workspace?.propertyLabel);
    } finally {
      setDownloading(false);
    }
  }, [rentalInput, workspace?.propertyLabel]);

  return (
    <TenantLayout>
      {loading ? (
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary mb-4" />
          <p className="text-sm text-gray-500">Loading your agreement…</p>
        </div>
      ) : loadError ? (
        <div className="max-w-lg mx-auto rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 items-start">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{loadError}</p>
        </div>
      ) : (
        <>
          <TenantAgreementReviewView
            agreement={reviewState.preview}
            presentation={reviewState.presentation}
            onProceed={handleProceed}
          />
          {paymentError ? (
            <div className="max-w-lg mx-auto mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{paymentError}</p>
            </div>
          ) : null}
          <TenantTrustLayerPaymentModal
            open={trustLayerOpen}
            presentation={reviewState.presentation}
            onClose={() => setTrustLayerOpen(false)}
            onProceedWithPayment={() => void handleProceedWithPayment()}
            proceeding={paying}
          />
          <TenantAgreementDownloadModal
            open={downloadOpen}
            onDownload={handleDownloadAgreement}
            downloading={downloading}
          />
        </>
      )}
    </TenantLayout>
  );
}

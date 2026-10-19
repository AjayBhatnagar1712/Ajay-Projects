import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { AlertCircle, ChevronLeft, FileSignature, Loader2, Upload } from "lucide-react";
import OwnerLayout from "@/components/OwnerLayout";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { getAgreements, updateAgreement } from "@/lib/agreements";
import { getActiveSession } from "@/lib/auth";
import {
  fetchAgreementSigningStatus,
  recordOwnerAgreementSignature,
  resolveOwnerSignerPhone,
  tenantPhoneFromAgreement,
} from "@/lib/ownerAgreementSigning";
import { downloadRentalAgreementPdf, type RentalAgreementInput } from "@/lib/rentalAgreementDocument";
import { cn } from "@/lib/utils";

type UploadPhase = "idle" | "uploading" | "success" | "error";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export default function OwnerUploadSignedAgreement() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/owner/agreements/:agreementId/upload-signed");
  const agreementId = params?.agreementId ?? "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leaseFullySigned, setLeaseFullySigned] = useState(false);

  const agreement = useMemo(
    () => getAgreements().find((row) => row.id === agreementId) ?? null,
    [agreementId],
  );

  const rentalInput = useMemo((): RentalAgreementInput | null => {
    if (!agreement) return null;
    return {
      propertyTitle: agreement.propertyTitle,
      ownerName: agreement.ownerName,
      ownerContact: agreement.ownerContact,
      tenantName: agreement.tenantName,
      tenantContact: agreement.tenantContact,
      coTenantName: agreement.coTenantContact,
      coTenantContact: agreement.coTenantContact,
      startDate: agreement.startDate,
      monthlyRent: agreement.monthlyRent,
      securityDeposit: agreement.securityDeposit,
      lockInPeriod: agreement.lockInPeriod,
      noticePeriod: agreement.noticePeriod,
      rentDueDay: agreement.rentDueDay,
      maintenanceCharges: agreement.maintenanceCharges,
      brokerageAmount: agreement.brokerageAmount,
      brokeragePaidBy: agreement.brokeragePaidBy,
      brokerageMode: agreement.brokerageMode,
      isOwnerFlow: true,
    };
  }, [agreement]);

  const bootstrap = useCallback(async () => {
    if (!agreementId) {
      setLoadError("Invalid agreement link");
      setLoading(false);
      return;
    }
    if (!agreement) {
      setLoadError("Agreement not found on this device");
      setLoading(false);
      return;
    }
    if (agreement.status === "Signed") {
      setLoading(false);
      return;
    }

    const status = await fetchAgreementSigningStatus(agreementId);
    if (!status) {
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (status.ownerSigned) {
      updateAgreement(agreementId, { status: "Signed" });
    }
    setLoading(false);
  }, [agreement, agreementId]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleDownload = async () => {
    if (!rentalInput) return;
    await downloadRentalAgreementPdf(rentalInput, agreement?.propertyTitle);
  };

  const handleFileSelect = async (file: File) => {
    if (!agreement) return;
    setErrorMessage(null);
    setFileName(file.name);
    setPhase("uploading");

    const session = getActiveSession();
    const signerPhone = resolveOwnerSignerPhone(agreement, session?.phone ?? agreement.ownerContact);
    if (!signerPhone) {
      setPhase("error");
      setErrorMessage("Could not match your account to the owner on this agreement.");
      return;
    }

    try {
      const fileUrl = await readFileAsDataUrl(file);
      const result = await recordOwnerAgreementSignature({
        agreementId: agreement.id,
        tenantPhone: tenantPhoneFromAgreement(agreement),
        signedPartyPhone: signerPhone,
        fileName: file.name,
        fileUrl,
      });

      if (!result.ok) {
        setPhase("error");
        setErrorMessage(result.error);
        return;
      }

      if (result.allSigned) {
        updateAgreement(agreement.id, { status: "Signed" });
        setLeaseFullySigned(true);
      }
      setPhase("success");
    } catch {
      setPhase("error");
      setErrorMessage("Could not upload your signed agreement. Please try again.");
    }
  };

  if (loading) {
    return (
      <OwnerLayout>
        <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-primary mb-4" />
          <p className="text-sm text-gray-500">Loading agreement…</p>
        </div>
      </OwnerLayout>
    );
  }

  if (!agreement) {
    return (
      <OwnerLayout>
        <div className="max-w-lg mx-auto rounded-2xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 items-start">
          <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{loadError ?? "Agreement not found"}</p>
        </div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout>
      <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-8">
        <div className="relative">
          <Link
            href="/owner/agreements"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary transition-colors"
          >
            <ChevronLeft size={18} aria-hidden />
            Back to Agreements
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mt-4 sm:mt-2">
            Upload Signed Agreement
          </h1>
          <p className="text-sm text-gray-500 text-center mt-2 max-w-lg mx-auto">
            Sign the rental agreement offline, then upload your signed copy to complete the lease
            with {agreement.tenantName || "your tenant"}.
          </p>
        </div>

        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={() => void handleDownload()}>
            Download agreement PDF
          </Button>
        </div>

        {phase === "success" ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-green-900">Signed agreement uploaded</p>
            <p className="text-sm text-green-800 mt-1">
              {fileName ? `"${fileName}"` : "Your file"} has been received.
              {leaseFullySigned
                ? " The lease is now fully signed."
                : " You can track the tenant's progress from your agreements list."}
            </p>
            <Button
              type="button"
              className={cn(authPrimaryButtonClass, "mt-5")}
              onClick={() => setLocation("/owner/agreements")}
            >
              Back to Agreements
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 sm:px-6 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileSignature size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Signed rental agreement</p>
                <p className="text-xs text-gray-500 mt-0.5">PDF or image up to 10 MB</p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {errorMessage ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}

              <button
                type="button"
                disabled={phase === "uploading"}
                onClick={() => document.getElementById("owner-signed-upload-input")?.click()}
                className={cn(
                  "w-full rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors",
                  phase === "uploading"
                    ? "border-gray-200 bg-gray-50 cursor-wait"
                    : "border-gray-200 bg-gray-50/80 hover:border-primary/40 hover:bg-[#F3F9FE]",
                )}
              >
                {phase === "uploading" ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={28} className="animate-spin text-primary" />
                    <p className="text-sm text-gray-600">Uploading your signed agreement…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-primary">
                      <Upload size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        Tap to upload signed agreement
                      </p>
                      <p className="text-xs text-gray-500 mt-1">PDF, JPG, or PNG</p>
                    </div>
                  </div>
                )}
              </button>

              <input
                id="owner-signed-upload-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 10 * 1024 * 1024) {
                    setErrorMessage("File is too large. Please upload a file under 10 MB.");
                    setPhase("error");
                    return;
                  }
                  void handleFileSelect(file);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </OwnerLayout>
  );
}

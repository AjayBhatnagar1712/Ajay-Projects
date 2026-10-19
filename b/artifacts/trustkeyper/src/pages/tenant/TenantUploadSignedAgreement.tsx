import { useRef, useState } from "react";
import { ChevronLeft, FileSignature, Loader2, Upload } from "lucide-react";
import { Link } from "wouter";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import TenantLayout from "@/components/TenantLayout";
import { getActiveSession } from "@/lib/auth";
import { getActiveTenantWorkspace } from "@/lib/tenantWorkspace";
import { recordTenantAgreementSignature } from "@/lib/tenantWorkflowServer";
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

export default function TenantUploadSignedAgreement() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setErrorMessage(null);
    setFileName(file.name);
    setPhase("uploading");

    const workspace = getActiveTenantWorkspace();
    const session = getActiveSession();
    const phone = workspace?.phone ?? session?.phone?.replace(/\D/g, "").slice(-10) ?? "";

    if (!workspace?.agreementId || phone.length !== 10) {
      setPhase("error");
      setErrorMessage("Agreement is not linked yet. Return to the dashboard and try again.");
      return;
    }

    try {
      const fileUrl = await readFileAsDataUrl(file);
      const updated = await recordTenantAgreementSignature({
        phone,
        agreementId: workspace.agreementId,
        signedPartyPhone: phone,
        fileName: file.name,
        fileUrl,
      });

      if (!updated) {
        setPhase("error");
        setErrorMessage("Could not save your signed agreement. Please try again.");
        return;
      }

      setPhase("success");
    } catch {
      setPhase("error");
      setErrorMessage("Could not upload your signed agreement. Please try again.");
    }
  };

  return (
    <TenantLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="relative">
          <Link
            href="/tenant/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-primary transition-colors"
          >
            <ChevronLeft size={18} aria-hidden />
            Back to Dashboard
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 text-center mt-4 sm:mt-2">
            Upload Signed Agreement
          </h1>
          <p className="text-sm text-gray-500 text-center mt-2 max-w-lg mx-auto">
            Upload the signed copy after you have signed your rental agreement offline.
          </p>
        </div>

        {phase === "success" ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-green-900">Signed agreement uploaded</p>
            <p className="text-sm text-green-800 mt-1">
              {fileName ? `"${fileName}"` : "Your file"} has been received. You can track other
              parties&apos; progress on your dashboard.
            </p>
            <Button type="button" className={cn(authPrimaryButtonClass, "mt-5")} asChild>
              <Link href="/tenant/dashboard">Go to Dashboard</Link>
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
                onClick={() => inputRef.current?.click()}
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
                ref={inputRef}
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
    </TenantLayout>
  );
}

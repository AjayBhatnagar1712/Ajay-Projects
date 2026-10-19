import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { Agreement } from "@/lib/agreements";
import {
  fetchAgreementSigningStatus,
  resolveAgreementSigningPresentation,
  type AgreementSigningStatus,
} from "@/lib/ownerAgreementSigning";

export function useAgreementSigningStatus(
  agreement: Agreement,
  enabled: boolean,
): AgreementSigningStatus | null {
  const [status, setStatus] = useState<AgreementSigningStatus | null>(null);

  useEffect(() => {
    if (!enabled || agreement.status !== "Sent") {
      setStatus(null);
      return;
    }

    let cancelled = false;
    void fetchAgreementSigningStatus(agreement.id).then((next) => {
      if (!cancelled) setStatus(next);
    });

    return () => {
      cancelled = true;
    };
  }, [agreement.id, agreement.status, enabled]);

  return status;
}

export function AgreementSigningInlineActions({
  agreement,
  requesterRole,
}: {
  agreement: Agreement;
  requesterRole: "owner" | "broker";
}) {
  const [, setLocation] = useLocation();
  const status = useAgreementSigningStatus(agreement, agreement.status === "Sent");
  const presentation = resolveAgreementSigningPresentation(status, agreement, requesterRole);

  if (agreement.status !== "Sent" || !presentation) return null;

  const showUpload =
    requesterRole === "owner" &&
    presentation.uploadLabel &&
    status &&
    !status.ownerSigned;

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <span
        className={`text-[11px] font-medium px-2 py-1 rounded-full border whitespace-nowrap ${
          presentation.tone === "complete"
            ? "text-green-700 bg-green-50 border-green-200"
            : presentation.tone === "action"
              ? "text-orange-700 bg-orange-50 border-orange-200"
              : "text-gray-600 bg-gray-50 border-gray-200"
        }`}
      >
        {presentation.label}
      </span>
      {showUpload ? (
        <button
          type="button"
          onClick={() => setLocation(`/owner/agreements/${agreement.id}/upload-signed`)}
          className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
        >
          {presentation.uploadLabel}
        </button>
      ) : null}
    </div>
  );
}

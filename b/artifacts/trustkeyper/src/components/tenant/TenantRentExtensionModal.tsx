import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FlowDateInput } from "@/components/flow/FlowDateInput";
import { authPrimaryButtonClass } from "@/components/auth/authStyles";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  submitTenantRentExtensionRequest,
  validateTenantRentExtensionInput,
} from "@/lib/tenantRentExtension";
import { cn } from "@/lib/utils";

export interface TenantRentExtensionModalProps {
  open: boolean;
  currentDueDateLabel: string;
  minimumExtensionDate: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function TenantRentExtensionModal({
  open,
  currentDueDateLabel,
  minimumExtensionDate,
  onClose,
  onSubmitted,
}: TenantRentExtensionModalProps) {
  const [requestedDate, setRequestedDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose, submitting]);

  useEffect(() => {
    if (open) return;
    setRequestedDate("");
    setReason("");
    setError(null);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const validation = validateTenantRentExtensionInput({
      requestedDate,
      reason,
      minimumExtensionDate,
    });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await submitTenantRentExtensionRequest({ requestedDate, reason });
      onSubmitted?.();
      onClose();
    } catch {
      setError("Could not submit your extension request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-[620px] animate-in zoom-in-95 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tenant-rent-extension-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-6">
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-6 h-6 flex items-center justify-center text-[#192839] hover:text-primary transition-colors disabled:opacity-50"
              aria-label="Close extension request"
            >
              <X size={20} />
            </button>
          </div>

          <div className="text-center mb-4">
            <h2
              id="tenant-rent-extension-title"
              className="text-base font-semibold text-[#192839] leading-6"
            >
              Request Rent Payment Extension
            </h2>
            <div className="h-px bg-[#d8e3ff] w-full mt-3" />
          </div>

          <div className="space-y-4">
            <p className="text-base text-[#192839] opacity-70">
              <span className="font-normal">Current Due Date: </span>
              <span className="font-semibold">{currentDueDateLabel}</span>
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="tenant-extension-date"
                className="text-sm text-[#161b3d] tracking-wide"
              >
                Requested Extension Date*
              </label>
              <FlowDateInput
                id="tenant-extension-date"
                value={requestedDate}
                onChange={setRequestedDate}
                min={minimumExtensionDate}
                className="h-9 max-w-[270px] rounded border-primary/20 bg-[#f8fafc] px-[18px]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="tenant-extension-reason"
                className="text-sm text-[#161b3d] tracking-wide"
              >
                Reason for Extension*
              </label>
              <Textarea
                id="tenant-extension-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Late salary"
                rows={3}
                className="min-h-[56px] rounded-sm border-0 border-b border-primary/20 bg-[#f1f5fa] px-3 py-2 text-sm text-[#192839] shadow-none focus-visible:ring-0 resize-y"
              />
              <p className="text-[11px] italic text-[#768ea7] leading-4">
                Note: Extensions are subject to owner approval
              </p>
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="pt-6 flex justify-center">
            <Button
              type="button"
              className={cn(authPrimaryButtonClass, "min-w-[180px] h-12 text-base font-normal")}
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Feedback submission modal — rating, category, message, and submit
 */
import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/hooks/use-toast";
import { getActiveSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Maximum message length accepted by the feedback API. */
const MESSAGE_MAX_LENGTH = 2000;

/** API category values accepted by POST /api/feedback. */
type FeedbackApiCategory = "bug" | "feature" | "general" | "other";

/** UI category option with label and API value. */
interface FeedbackCategoryOption {
  label: string;
  value: FeedbackApiCategory;
}

/** Selectable feedback categories shown as pill buttons. */
const CATEGORY_OPTIONS: readonly FeedbackCategoryOption[] = [
  { label: "Bug Report", value: "bug" },
  { label: "Feature Request", value: "feature" },
  { label: "General", value: "general" },
  { label: "Praise", value: "other" },
] as const;

/** Request body sent to POST /api/feedback. */
interface FeedbackSubmitPayload {
  rating: number;
  category: FeedbackApiCategory;
  message: string;
  phone?: string;
  role?: string;
  pageUrl?: string;
}

/** Successful response from POST /api/feedback. */
interface FeedbackSubmitResponse {
  feedbackId: string;
  createdAt: string;
}

/** Props for {@link FeedbackModal}. */
export interface FeedbackModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Called when the open state should change (e.g. user closes the dialog). */
  onOpenChange: (open: boolean) => void;
}

/**
 * Resets modal form fields to their initial state.
 * @returns Initial form values.
 */
function createInitialFormState(): {
  rating: number;
  category: FeedbackApiCategory | null;
  message: string;
} {
  return { rating: 0, category: null, message: "" };
}

/**
 * Submits feedback to the API.
 * @param payload - Validated feedback payload.
 * @returns Parsed success response.
 * @throws When the network request fails or the API returns a non-2xx status.
 */
async function submitFeedback(payload: FeedbackSubmitPayload): Promise<FeedbackSubmitResponse> {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Feedback submit failed with status ${response.status}`);
  }

  return (await response.json()) as FeedbackSubmitResponse;
}

/**
 * Modal form for collecting and submitting user feedback.
 * @param props - Component props.
 * @returns Feedback dialog.
 */
export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const [{ rating, category, message }, setForm] = useState(createInitialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const resetForm = useCallback(() => {
    setForm(createInitialFormState());
    setIsSubmitting(false);
    setIsSuccess(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  useEffect(() => {
    if (!isSuccess) return undefined;

    const timer = window.setTimeout(() => {
      onOpenChange(false);
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [isSuccess, onOpenChange]);

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5 || !category) return;

    const trimmedMessage = message.trim();
    const payload: FeedbackSubmitPayload = {
      rating,
      category,
      message: trimmedMessage || "No additional comments.",
      pageUrl: window.location.href,
    };

    const session = getActiveSession();
    if (session) {
      payload.phone = session.phone;
      payload.role = session.role;
    }

    setIsSubmitting(true);

    try {
      await submitFeedback(payload);
      setIsSuccess(true);
    } catch {
      toast({
        title: "Could not send feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = rating >= 1 && category !== null && !isSubmitting && !isSuccess;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0 sm:rounded-2xl">
        <DialogHeader className="border-b px-6 pb-4 pt-6 text-left">
          <DialogTitle className="text-xl font-semibold text-gray-900">
            Share your feedback
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Help us improve TrustKeyper
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="px-6 py-10 text-center">
            <p className="text-base font-medium text-gray-900">
              Thank you! Your feedback helps us improve.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 px-6 py-5">
            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Rating</p>
              <div className="flex gap-1" role="group" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((value) => {
                  const filled = value <= rating;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Rate ${value} out of 5 stars`}
                      aria-pressed={filled}
                      disabled={isSubmitting}
                      onClick={() => setForm((prev) => ({ ...prev, rating: value }))}
                      className="rounded p-1 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4F8A]/30 disabled:opacity-50"
                    >
                      <Star
                        className={cn(
                          "h-7 w-7",
                          filled
                            ? "fill-amber-400 text-amber-400"
                            : "fill-none text-gray-300",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-gray-700">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const selected = category === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isSubmitting}
                      aria-pressed={selected}
                      onClick={() =>
                        setForm((prev) => ({ ...prev, category: option.value }))
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B4F8A]/30 disabled:opacity-50",
                        selected
                          ? "border-[#1B4F8A] bg-[#1B4F8A] text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="feedback-message"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Message <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <Textarea
                id="feedback-message"
                value={message}
                disabled={isSubmitting}
                maxLength={MESSAGE_MAX_LENGTH}
                placeholder="Tell us more..."
                rows={4}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, message: event.target.value }))
                }
                className="resize-none"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {message.length}/{MESSAGE_MAX_LENGTH}
              </p>
            </div>

            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              className="h-11 w-full rounded-lg bg-[#1B4F8A] text-white hover:bg-[#1B4F8A]/90"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="text-white" />
                  Sending…
                </>
              ) : (
                "Send Feedback"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

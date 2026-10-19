import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { generateLeaseAgreementDocument } from "@workspace/lease-agreement/text";
import type { LeaseAgreementHighlightKind } from "@workspace/lease-agreement/text";
import { AlertCircle, CheckCircle2, Clock, Loader2, Phone, WifiOff } from "lucide-react";
import { TrustKeyperLogo } from "@/components/brand";
import { WithdrawApprovalDialog } from "@/components/lease/WithdrawApprovalDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AGREEMENT_MOVED_FORWARD_MESSAGE,
  fetchLeaseAgreementReview,
  formatApprovalStatusLabel,
  formatBrokerPhoneDisplay,
  formatPartyRoleLabel,
  normalizeBrokerTelHref,
  reviewUnavailableCopy,
  submitLeaseAgreementReview,
  toLeaseAgreementPdfInput,
  type LeaseReviewDecision,
  type LeaseReviewFetchErrorKind,
  type LeaseReviewPayload,
  type LeaseReviewSubmitResult,
} from "@/lib/publicLeaseAgreementReview";
import { cn } from "@/lib/utils";

type PagePhase =
  | "loading"
  | "ready"
  | "invalid"
  | "expired"
  | "error"
  | "submitted"
  | "changes_recorded"
  | "withdrawn";

const HIGHLIGHT_CLASS: Record<LeaseAgreementHighlightKind, string> = {
  rent: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5",
  deposit: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5",
  startDate: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5",
  endDate: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5",
  noticeLicensee: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5",
  noticeLicensor: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5",
  minStay: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5",
  partyName: "bg-sky-100/90 text-slate-900 rounded-sm px-0.5 font-medium",
};

function ReviewUnavailableState({
  kind,
  message,
}: {
  kind: LeaseReviewFetchErrorKind;
  message?: string;
}) {
  const copy = reviewUnavailableCopy(kind);
  const description = message?.trim() || copy.description;
  const Icon =
    kind === "expired" ? Clock : kind === "network" ? WifiOff : AlertCircle;

  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-12 text-center"
      role="alert"
      aria-live="assertive"
    >
      <div
        className="flex size-16 items-center justify-center rounded-full bg-[#D8E4FD]"
        aria-hidden
      >
        <Icon className="size-8 text-[#1B3591]" strokeWidth={1.75} />
      </div>
      <div className="max-w-md space-y-3">
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-slate-900">
          {copy.title}
        </h1>
        <p className="text-base leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function StatusBanner({
  kind,
  title,
  message,
}: {
  kind: "error" | "success" | "info";
  title: string;
  message: string;
}) {
  const styles =
    kind === "error"
      ? "bg-red-50 text-red-900 ring-red-100"
      : kind === "success"
        ? "bg-emerald-50 text-emerald-900 ring-emerald-100"
        : "bg-blue-50 text-blue-900 ring-blue-100";
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`rounded-2xl px-5 py-5 ring-1 ${styles}`} role="status">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold text-base">{title}</p>
          <p className="mt-1 text-sm leading-relaxed opacity-90">{message}</p>
        </div>
      </div>
    </div>
  );
}

function AgreementDocumentCard({ payload }: { payload: LeaseReviewPayload }) {
  const document = useMemo(
    () => generateLeaseAgreementDocument(toLeaseAgreementPdfInput(payload)),
    [payload],
  );

  return (
    <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200/70 sm:px-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-primary mb-4">
        Leave &amp; licence agreement
      </h2>
      <div className="space-y-3 text-[15px] leading-7 text-slate-800 sm:text-base sm:leading-7">
        {document.lines.map((entry, lineIndex) => {
          const text = entry.runs.map((run) => run.text).join("");
          const isHeading =
            text === "LEAVE & LICENCE AGREEMENT" ||
            text === "BETWEEN" ||
            text === "AND" ||
            text === "LICENSOR:" ||
            text === "LICENSEES:" ||
            text === "ANNEXURE - 1" ||
            text === "DESCRIPTION OF THE SAID PREMISES:" ||
            text.startsWith("NOW THEREFORE");

          return (
            <p
              key={`line-${lineIndex}`}
              className={cn(
                "whitespace-pre-wrap break-words",
                isHeading && "font-semibold text-slate-900 tracking-tight",
                text.startsWith("LEAVE & LICENCE") && "text-lg sm:text-xl",
              )}
            >
              {entry.runs.map((run, runIndex) =>
                run.highlight ? (
                  <mark
                    key={`run-${lineIndex}-${runIndex}`}
                    className={cn(HIGHLIGHT_CLASS[run.highlight], "not-italic")}
                  >
                    {run.text}
                  </mark>
                ) : (
                  <React.Fragment key={`run-${lineIndex}-${runIndex}`}>{run.text}</React.Fragment>
                ),
              )}
            </p>
          );
        })}
      </div>
    </section>
  );
}

export default function LeaseAgreementReviewPage() {
  const [, params] = useRoute("/review/:token");
  const token = params?.token ?? "";

  const [phase, setPhase] = useState<PagePhase>("loading");
  const [payload, setPayload] = useState<LeaseReviewPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<LeaseReviewFetchErrorKind | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<LeaseReviewSubmitResult | null>(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentSaved, setCommentSaved] = useState(false);
  /** Inline decision submit — keeps agreement mounted so scroll is preserved. */
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [withdrawConfirmOpen, setWithdrawConfirmOpen] = useState(false);

  const applyErrorKind = useCallback((kind: LeaseReviewFetchErrorKind, message: string) => {
    setErrorMessage(message);
    setErrorKind(kind);
    if (kind === "not_found" || kind === "invalid") setPhase("invalid");
    else if (kind === "expired") setPhase("expired");
    else setPhase("error");
  }, []);

  const applyViewerFromResult = useCallback((result: LeaseReviewSubmitResult) => {
    setSubmitResult(result);
    setPayload((prev) =>
      prev
        ? {
            ...prev,
            viewer: {
              ...prev.viewer,
              approvalStatus: result.decision,
              reviewComment: result.comment,
              reviewedAt: result.reviewedAt,
            },
          }
        : prev,
    );
  }, []);

  const load = useCallback(async () => {
    setPhase("loading");
    setErrorMessage(null);
    setSubmitError(null);
    setCommentSaved(false);
    const result = await fetchLeaseAgreementReview(token);
    if (!result.ok) {
      applyErrorKind(result.kind, result.message);
      return;
    }
    setPayload(result.payload);
    setComment(result.payload.viewer.reviewComment ?? "");
    if (result.payload.viewer.approvalStatus === "changes_requested") {
      setPhase("changes_recorded");
      setSubmitResult({
        decision: "changes_requested",
        comment: result.payload.viewer.reviewComment,
        reviewedAt: result.payload.viewer.reviewedAt,
        party: {
          name: result.payload.viewer.name,
          role: result.payload.viewer.role,
          approvalStatus: "changes_requested",
        },
      });
    } else if (result.payload.viewer.approvalStatus === "approved") {
      setPhase("submitted");
      setSubmitResult({
        decision: "approved",
        comment: result.payload.viewer.reviewComment,
        reviewedAt: result.payload.viewer.reviewedAt,
        party: {
          name: result.payload.viewer.name,
          role: result.payload.viewer.role,
          approvalStatus: "approved",
        },
      });
    } else if (result.payload.viewer.approvalStatus === "withdrawn") {
      setPhase("withdrawn");
      setSubmitResult({
        decision: "withdrawn",
        comment: result.payload.viewer.reviewComment,
        reviewedAt: result.payload.viewer.reviewedAt,
        party: {
          name: result.payload.viewer.name,
          role: result.payload.viewer.role,
          approvalStatus: "withdrawn",
        },
      });
    } else {
      setPhase("ready");
    }
  }, [token, applyErrorKind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previous = document.title;
    document.title = "Agreement review · TrustKeyper";
    return () => {
      document.title = previous;
    };
  }, []);

  const handleApprove = async () => {
    setCommentError(null);
    setSubmitError(null);
    setDecisionSubmitting(true);
    const result = await submitLeaseAgreementReview(token, "approved");
    setDecisionSubmitting(false);
    if (!result.ok) {
      if (result.kind === "not_found" || result.kind === "expired" || result.kind === "invalid") {
        applyErrorKind(result.kind, result.message);
        return;
      }
      setPhase((prev) =>
        prev === "changes_recorded" || prev === "submitted" || prev === "withdrawn"
          ? prev
          : "ready",
      );
      setSubmitError(result.message);
      return;
    }
    applyViewerFromResult(result.result);
    setPhase("submitted");
  };

  const handleRequestChanges = async () => {
    setSubmitError(null);
    setCommentError(null);
    setDecisionSubmitting(true);
    const result = await submitLeaseAgreementReview(token, "changes_requested");
    setDecisionSubmitting(false);
    if (!result.ok) {
      if (result.kind === "not_found" || result.kind === "expired") {
        applyErrorKind(result.kind, result.message);
        return;
      }
      setPhase((prev) =>
        prev === "submitted" || prev === "changes_recorded" || prev === "withdrawn"
          ? prev
          : "ready",
      );
      setSubmitError(result.message);
      return;
    }
    applyViewerFromResult(result.result);
    setCommentSaved(false);
    setPhase("changes_recorded");
  };

  const handleOptionalComment = async () => {
    setCommentError(null);
    setSubmitError(null);
    const trimmed = comment.trim();
    if (!trimmed) {
      setCommentError("Add a short note, or skip this and call your broker.");
      return;
    }
    setCommentSaving(true);
    const result = await submitLeaseAgreementReview(token, "changes_requested", trimmed);
    setCommentSaving(false);
    if (!result.ok) {
      if (result.kind === "not_found" || result.kind === "expired") {
        applyErrorKind(result.kind, result.message);
        return;
      }
      setSubmitError(result.message);
      return;
    }
    applyViewerFromResult(result.result);
    setCommentSaved(true);
  };

  const handleWithdraw = async () => {
    setSubmitError(null);
    setDecisionSubmitting(true);
    const result = await submitLeaseAgreementReview(token, "withdrawn");
    setDecisionSubmitting(false);
    if (!result.ok) {
      if (result.kind === "not_found" || result.kind === "expired" || result.kind === "invalid") {
        applyErrorKind(result.kind, result.message);
        return;
      }
      setSubmitError(result.message);
      return;
    }
    applyViewerFromResult(result.result);
    setPhase("withdrawn");
  };

  const brokerTel = normalizeBrokerTelHref(payload?.broker?.phone);
  const brokerPhoneLabel = formatBrokerPhoneDisplay(payload?.broker?.phone);
  const canDecide = payload?.status === "in_review";
  const previousDecision: LeaseReviewDecision | null =
    payload?.viewer.approvalStatus === "approved" ||
    payload?.viewer.approvalStatus === "changes_requested"
      ? payload.viewer.approvalStatus
      : null;

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <TrustKeyperLogo size="header" />
          <p className="text-xs font-medium text-slate-500 sm:text-sm">Agreement review</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6 sm:px-6 sm:py-8 space-y-5 pb-28">
        {phase === "loading" ? (
          <div
            className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-600"
            role="status"
            aria-live="polite"
            aria-label="Loading agreement"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm">Loading your agreement…</p>
          </div>
        ) : null}

        {phase === "invalid" || phase === "expired" || phase === "error" ? (
          <ReviewUnavailableState
            kind={
              errorKind ??
              (phase === "expired"
                ? "expired"
                : phase === "invalid"
                  ? "not_found"
                  : "server")
            }
            message={errorMessage ?? undefined}
          />
        ) : null}

        {(phase === "ready" ||
          phase === "submitted" ||
          phase === "changes_recorded" ||
          phase === "withdrawn") &&
        payload ? (
          <>
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Hello {payload.viewer.name},</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
                Please review this leave &amp; licence agreement
              </h1>
              <p className="text-sm leading-relaxed text-slate-600">
                Your broker shared this draft for your review. Read the full agreement below, then
                approve or request changes. You are reviewing as{" "}
                <span className="font-medium text-slate-800">
                  {formatPartyRoleLabel(payload.viewer.role)}
                </span>
                .
              </p>
            </div>

            {previousDecision && phase === "ready" ? (
              <StatusBanner
                kind="info"
                title={`You previously ${formatApprovalStatusLabel(previousDecision).toLowerCase()}`}
                message={
                  payload.viewer.reviewComment
                    ? `Your note: “${payload.viewer.reviewComment}”. You can change your response below before this link expires.`
                    : "You can change your response below before this link expires."
                }
              />
            ) : null}

            <AgreementDocumentCard payload={payload} />

            {phase === "submitted" && submitResult?.decision === "approved" ? (
              <StatusBanner
                kind="success"
                title="Thank you — you approved this agreement"
                message={
                  canDecide
                    ? "Your broker can see your approval. You can withdraw this approval using this link until it expires."
                    : "Your broker can see your approval."
                }
              />
            ) : null}

            {phase === "withdrawn" ? (
              <StatusBanner
                kind="info"
                title="You withdrew your approval"
                message="Your broker can see this. Ask them to send a new link if you want to review again."
              />
            ) : null}

            {!canDecide ? (
              <StatusBanner
                kind="info"
                title="This agreement has moved forward"
                message={AGREEMENT_MOVED_FORWARD_MESSAGE}
              />
            ) : null}

            {phase === "ready" && canDecide ? (
              <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200/70 sm:px-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Your response
                </h2>
                {submitError ? (
                  <p className="text-sm text-red-700" role="alert">
                    {submitError}
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full sm:flex-1"
                    disabled={decisionSubmitting}
                    onClick={() => void handleApprove()}
                  >
                    {decisionSubmitting ? "Sending…" : "Approve"}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="w-full sm:flex-1"
                    disabled={decisionSubmitting}
                    onClick={() => void handleRequestChanges()}
                  >
                    {decisionSubmitting ? "Sending…" : "Request changes"}
                  </Button>
                </div>
              </section>
            ) : null}

            {phase === "changes_recorded" ? (
              <section className="rounded-2xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200/70 sm:px-6 space-y-4">
                <StatusBanner
                  kind="success"
                  title="Change request recorded"
                  message={
                    commentSaved || submitResult?.comment
                      ? "Your broker can see your request. Call them if you want to discuss, or update your optional note below."
                      : "Your broker can already see that you requested changes. Call them to discuss — a written note is optional."
                  }
                />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
                  Next step
                </h2>
                {brokerTel ? (
                  <a
                    href={brokerTel}
                    className="inline-flex w-full min-h-12 items-center justify-center gap-2 rounded-[4px] bg-primary px-6 text-base font-medium text-primary-foreground border border-primary-border"
                  >
                    <Phone className="h-4 w-4" aria-hidden />
                    Call {payload.broker?.name ?? "broker"}
                    {brokerPhoneLabel ? ` (${brokerPhoneLabel})` : ""}
                  </a>
                ) : (
                  <p className="text-sm text-slate-600">
                    Ask your broker for a phone number — we could not find a dialable contact on this
                    link.
                  </p>
                )}

                {canDecide ? (
                  <>
                    <div className="space-y-2 border-t border-slate-100 pt-4">
                      <label htmlFor="review-comment" className="block text-sm font-medium text-slate-800">
                        Optional note for your broker
                      </label>
                      <p className="text-xs text-slate-500">
                        Optional — calling is enough. Add a note only if you want something in writing.
                      </p>
                      <Textarea
                        id="review-comment"
                        value={comment}
                        onChange={(event) => {
                          setComment(event.target.value);
                          if (commentError) setCommentError(null);
                          setCommentSaved(false);
                        }}
                        placeholder="Example: Please reduce the rent to Rs.50,000."
                        className="min-h-24 bg-white"
                      />
                      {commentError ? (
                        <p className="text-sm text-red-700" role="alert">
                          {commentError}
                        </p>
                      ) : null}
                      {submitError ? (
                        <p className="text-sm text-red-700" role="alert">
                          {submitError}
                        </p>
                      ) : null}
                      {commentSaved ? (
                        <p className="text-sm text-emerald-700" role="status">
                          Note sent to your broker.
                        </p>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={commentSaving || decisionSubmitting}
                        onClick={() => void handleOptionalComment()}
                      >
                        {commentSaving ? "Sending…" : "Send optional note"}
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full sm:w-auto"
                      disabled={decisionSubmitting}
                      onClick={() => void handleApprove()}
                    >
                      {decisionSubmitting ? "Sending…" : "Change to Approve instead"}
                    </Button>
                  </>
                ) : null}
              </section>
            ) : null}

            {phase === "submitted" && canDecide ? (
              <div className="space-y-3">
                {submitError ? (
                  <p className="text-sm text-red-700" role="alert">
                    {submitError}
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="w-full"
                  disabled={decisionSubmitting}
                  onClick={() => setWithdrawConfirmOpen(true)}
                >
                  {decisionSubmitting ? "Sending…" : "Withdraw approval"}
                </Button>
              </div>
            ) : null}

            <WithdrawApprovalDialog
              open={withdrawConfirmOpen}
              onOpenChange={setWithdrawConfirmOpen}
              onConfirm={() => void handleWithdraw()}
            />
          </>
        ) : null}

        {phase === "error" ? (
          <Button type="button" onClick={() => void load()} className="w-full sm:w-auto">
            Try again
          </Button>
        ) : null}
      </main>
    </div>
  );
}

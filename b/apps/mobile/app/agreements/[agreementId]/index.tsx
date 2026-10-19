import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert as NativeAlert, View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import {
  allPartiesApproved,
  formatAgreementDate,
  formatAgreementMoney,
  inferAgreementCreationStep,
  needsReviewResend,
  partyChangesComment,
  partyReviewHeadline,
  partyReviewLinkNote,
  partyReviewSendActionTitle,
  partyReviewStatusIcon,
  partyRoleLabel,
  resolveReviewLinkStatus,
} from "@/lib/agreements/flow";
import { pushCreateAgreementStep } from "@/lib/agreements/createAgreementNav";
import { capturePreviewEditSnapshot } from "@/lib/agreements/previewEditSession";
import { openReviewShareScreen, reviewSharePartyFromResend } from "@/lib/agreements/reviewShare";
import {
  getLeaseAgreement,
  renewLeaseAgreement,
  resendLeaseAgreementPartyReview,
  sendLeaseAgreementReview,
  updateLeaseAgreementStatus,
  type LeaseAgreementParty,
  type LeaseAgreementStatusUpdate,
} from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { AgreementStatusChip } from "@/lib/ui/AgreementStatusChip";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { RecordCard, RecordDetailRow } from "@/lib/ui/RecordCard";
import { Stack } from "@/lib/ui/Stack";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { Spinner } from "@/lib/ui/Spinner";
import { Heading, Text } from "@/lib/ui/Typography";

function routeId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function routeNotice(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function shortAgreementId(id: string): string {
  return id.slice(0, 8);
}

function partyAlertColor(party: LeaseAgreementParty): "neutral" | "positive" | "notice" {
  if (party.approvalStatus === "approved") return "positive";
  if (party.approvalStatus === "changes_requested") return "notice";
  if (party.approvalStatus === "withdrawn") return "notice";
  if (resolveReviewLinkStatus(party) === "expired") return "notice";
  return "neutral";
}

function PartyReviewCard({
  party,
  showResend,
  busy,
  isResending,
  onResend,
}: {
  party: LeaseAgreementParty;
  showResend: boolean;
  busy: boolean;
  isResending: boolean;
  onResend: () => void;
}) {
  const theme = useAppTheme();
  const comment = partyChangesComment(party);
  const linkNote = partyReviewLinkNote(party);
  const headline = partyReviewHeadline(party);
  const statusIcon = partyReviewStatusIcon(party);
  const sendActionTitle = partyReviewSendActionTitle(party);
  const role = partyRoleLabel(party.role);

  return (
    <RecordCard accessibilityLabel={`${party.name}, ${role}. ${headline}`}>
      <View style={{ width: "100%", gap: 4 }}>
        <PaperText
          variant="titleMedium"
          style={{
            color: theme.colors.headingText,
            fontFamily: fontFamilies.generalSansSemibold,
          }}
        >
          {party.name}
        </PaperText>
        <PaperText
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          {role}
        </PaperText>
      </View>

      <View
        style={{
          width: "100%",
          marginTop: 4,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          gap: 8,
        }}
      >
        <PaperText
          variant="labelMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoMedium,
            letterSpacing: 0.2,
            textTransform: "uppercase",
          }}
        >
          Response
        </PaperText>

        <View
          style={{
            width: "100%",
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
            paddingLeft: 12,
            gap: 10,
          }}
        >
          <Alert
            color={partyAlertColor(party)}
            icon={statusIcon}
            iconColor={party.approvalStatus === "approved" ? theme.colors.success : undefined}
            description={headline}
          />
          {linkNote ? (
            <Text color="subtle" size="small">
              {linkNote}
            </Text>
          ) : null}
          {comment ? (
            <PaperText
              variant="bodyMedium"
              style={{
                color: theme.colors.bodyText,
                fontFamily: fontFamilies.robotoRegular,
              }}
            >
              {comment}
            </PaperText>
          ) : null}
          {showResend ? (
            <Button
              title={sendActionTitle}
              variant="secondary"
              textColor={theme.colors.primary}
              outlineColor={theme.colors.primary}
              isFullWidth={false}
              isDisabled={busy}
              isLoading={isResending}
              onPress={onResend}
            />
          ) : null}
        </View>
      </View>
    </RecordCard>
  );
}

export default function LeaseAgreementDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{
    agreementId?: string | string[];
    notice?: string | string[];
  }>();
  const agreementId = routeId(params.agreementId);
  const notice = routeNotice(params.notice);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendingPartyId, setResendingPartyId] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["lease-agreement", agreementId],
    queryFn: () => getLeaseAgreement(agreementId ?? ""),
    enabled: agreementId !== undefined,
  });

  const statusMutation = useMutation({
    mutationFn: (status: LeaseAgreementStatusUpdate) => updateLeaseAgreementStatus(agreementId ?? "", status),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Could not update status");
    },
  });

  const renewMutation = useMutation({
    mutationFn: async () => {
      if (!agreementId) {
        throw new Error("No agreement was selected.");
      }
      return await renewLeaseAgreement(agreementId);
    },
    onSuccess: async (renewed) => {
      setActionError(null);
      queryClient.setQueryData(["lease-agreement", renewed.id], renewed);
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      pushCreateAgreementStep(router, 5, "agreements", renewed.id);
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not create renewal draft";
      setActionError(message);
    },
  });

  function goBack(): void {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/agreements");
  }

  function goToAgreementsList(): void {
    router.replace("/(tabs)/agreements");
  }

  async function openEditFlow(): Promise<void> {
    if (!agreementId) return;
    setActionError(null);
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["lease-agreement", agreementId],
        queryFn: () => getLeaseAgreement(agreementId),
      });
      const step = inferAgreementCreationStep(detail);
      pushCreateAgreementStep(router, step, "agreements", agreementId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not open editor");
    }
  }

  async function openReviewEditDraft(): Promise<void> {
    if (!agreementId) return;
    setActionError(null);
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["lease-agreement", agreementId],
        queryFn: () => getLeaseAgreement(agreementId),
      });
      capturePreviewEditSnapshot(detail);
      pushCreateAgreementStep(router, 1, "agreements", agreementId, "review");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not open editor");
    }
  }

  function openPreview(): void {
    if (!agreementId) return;
    router.push({
      pathname: "/agreements/[agreementId]/preview",
      params: { agreementId, entry: "agreements" },
    });
  }

  function openSignedPdf(): void {
    if (!agreementId) return;
    router.push({
      pathname: "/agreements/[agreementId]/signed",
      params: { agreementId },
    });
  }

  function openOriginalAgreement(originalAgreementId: string): void {
    router.push({
      pathname: "/agreements/[agreementId]",
      params: { agreementId: originalAgreementId },
    });
  }

  function confirmRenew(): void {
    NativeAlert.alert(
      "Renew agreement?",
      "This creates a new draft with the same property, parties, and terms. Dates will be recalculated before you review and send it again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Renew", onPress: () => renewMutation.mutate() },
      ],
    );
  }

  function confirmEditDraft(): void {
    NativeAlert.alert("Edit draft?", "Editing will reset all approvals — everyone will need to review again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Edit draft", onPress: () => void openReviewEditDraft() },
    ]);
  }

  async function mintAndOpenShareScreen(errorFallback: string): Promise<void> {
    if (!agreementId || !detailQuery.data) return;
    setActionError(null);
    setIsResending(true);
    try {
      const result = await sendLeaseAgreementReview(agreementId);
      if (result.parties.length === 0) {
        setActionError("Could not create review links for the parties.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
      openReviewShareScreen(
        router,
        queryClient,
        {
          agreementId,
          propertyAddress: detailQuery.data.propertyAddress ?? "the property",
          parties: result.parties,
        },
        "push",
      );
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : error instanceof Error ? error.message : errorFallback;
      setActionError(message);
    } finally {
      setIsResending(false);
    }
  }

  function confirmSendForReview(): void {
    NativeAlert.alert(
      "Send for review?",
      "This creates a review link for each party. You can then share each person's link when you're ready.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send for review",
          onPress: () => void mintAndOpenShareScreen("Could not send for review"),
        },
      ],
    );
  }

  function confirmResendToAll(): void {
    NativeAlert.alert(
      "Resend to all parties?",
      "This creates fresh review links for everyone and clears all responses — including any approvals already received. You can then share each person's link when you're ready.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Resend to all parties",
          onPress: () => void mintAndOpenShareScreen("Could not resend review links"),
        },
      ],
    );
  }

  async function resendOneParty(party: LeaseAgreementParty): Promise<void> {
    if (!agreementId || !detailQuery.data) return;
    setActionError(null);
    setResendingPartyId(party.id);
    try {
      const result = await resendLeaseAgreementPartyReview(agreementId, party.id);
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
      openReviewShareScreen(
        router,
        queryClient,
        {
          agreementId,
          propertyAddress: detailQuery.data.propertyAddress ?? "the property",
          parties: [reviewSharePartyFromResend(party.id, result)],
        },
        "push",
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not resend the review link";
      setActionError(message);
    } finally {
      setResendingPartyId(null);
    }
  }

  function confirmResendOneParty(party: LeaseAgreementParty): void {
    const action = partyReviewSendActionTitle(party);
    NativeAlert.alert(
      `${action} to ${party.name}?`,
      resolveReviewLinkStatus(party) === "none"
        ? "This creates a review link for this person only. Other parties are not affected."
        : "This creates a fresh link for this person only and clears their response. Other parties are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        { text: action, onPress: () => void resendOneParty(party) },
      ],
    );
  }

  function confirmStatus(next: LeaseAgreementStatusUpdate, title: string, body: string): void {
    NativeAlert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      {
        text: title,
        onPress: () => statusMutation.mutate(next),
      },
    ]);
  }

  if (!agreementId) {
    return (
      <ScreenSafeArea>
        <StackScreenHeader title="Agreement" fallbackHref="/(tabs)/agreements" onBack={goBack} />
        <Alert description="No agreement was selected." />
        <Button title="Back to agreements" onPress={goBack} />
      </ScreenSafeArea>
    );
  }

  if (detailQuery.isLoading) {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Agreement" fallbackHref="/(tabs)/agreements" onBack={goBack} />
        <Spinner accessibilityLabel="Loading agreement" />
        <Text color="subtle">Loading agreement…</Text>
      </ScreenSafeArea>
    );
  }

  if (detailQuery.error || !detailQuery.data) {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Agreement" fallbackHref="/(tabs)/agreements" onBack={goBack} />
        <ErrorRecoveryActions variant="unknown" onRetry={() => void detailQuery.refetch()} />
      </ScreenSafeArea>
    );
  }

  const detail = detailQuery.data;
  const status = detail.status;
  const hasSignedPdf = detail.hasSignedPdf === true;
  const approvedAll = allPartiesApproved(detail.parties);
  const awaitingResend = needsReviewResend(status, detail.parties);
  const busy = statusMutation.isPending || renewMutation.isPending || isResending || resendingPartyId !== null;
  const showReviewSavedNotice = notice === "review-saved" && status === "in_review";
  const address = detail.propertyAddress ?? "Property address not added";
  const renewedFromAgreementId = detail.renewedFromAgreementId ?? null;

  return (
    <ScreenSafeArea
      refreshing={detailQuery.isRefetching && !detailQuery.isLoading}
      onRefresh={() => void detailQuery.refetch()}
    >
      <StackScreenHeader
        title={address}
        fallbackHref="/(tabs)/agreements"
        onBack={goBack}
        right={<AgreementStatusChip status={status} />}
      />

      {actionError ? <Alert description={actionError} /> : null}

      {showReviewSavedNotice ? (
        <Alert
          color="information"
          title="Changes saved"
          description="This agreement is under Sent for signing. Approvals were reset — resend review links so everyone can review the updated version."
        />
      ) : null}

      {awaitingResend ? (
        <Stack gap="spacing.3">
          {!showReviewSavedNotice ? (
            <Alert
              color="notice"
              title="Updated — send again"
              description="This agreement has changed since it was last sent. Send it again so everyone can review the updated version."
            />
          ) : null}
          <Button
            title="Resend to all parties"
            onPress={confirmResendToAll}
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            isDisabled={busy}
            isLoading={isResending}
          />
        </Stack>
      ) : null}

      <RecordCard title="Key terms">
        <View style={{ width: "100%", gap: 6 }}>
          <RecordDetailRow label="Rent" value={formatAgreementMoney(detail.monthlyRentPaise)} />
          <RecordDetailRow label="Deposit" value={formatAgreementMoney(detail.securityDepositPaise)} />
          {detail.brokerageFeePaise != null && detail.brokerageFeePaise > 0 ? (
            <RecordDetailRow
              label="Consultancy fee"
              value={formatAgreementMoney(detail.brokerageFeePaise)}
            />
          ) : null}
          <RecordDetailRow label="Start" value={formatAgreementDate(detail.effectiveDate)} />
          <RecordDetailRow label="End" value={formatAgreementDate(detail.endDate)} />
        </View>
      </RecordCard>

      {renewedFromAgreementId ? (
        <RecordCard title="Renewal history">
          <View style={{ width: "100%", gap: 12 }}>
            <RecordDetailRow label="Renewed from" value={shortAgreementId(renewedFromAgreementId)} />
            <Button
              title="Open original agreement"
              variant="secondary"
              textColor={theme.colors.primary}
              outlineColor={theme.colors.primary}
              onPress={() => openOriginalAgreement(renewedFromAgreementId)}
              isDisabled={busy}
            />
          </View>
        </RecordCard>
      ) : null}

      {status === "in_review" || status === "esign_sent" || status === "signed" ? (
        <Stack gap="spacing.3">
          <Heading size="small">Review status</Heading>
          {status === "in_review" && approvedAll && !awaitingResend ? (
            <Alert
              color="positive"
              title="All parties have approved"
              description="You can mark this agreement as sent for signing. Complete eSign outside the app for now."
            />
          ) : null}
          {detail.parties.map((party) => (
            <PartyReviewCard
              key={party.id}
              party={party}
              showResend={status === "in_review"}
              busy={busy}
              isResending={resendingPartyId === party.id}
              onResend={() => confirmResendOneParty(party)}
            />
          ))}
        </Stack>
      ) : null}

      {status === "draft" ? (
        <Stack gap="spacing.3">
          <Button title="Send for review" onPress={confirmSendForReview} isDisabled={busy} isLoading={isResending} />
          <Button title="Continue editing" variant="secondary" onPress={() => void openEditFlow()} isDisabled={busy} />
          <Button
            title="Preview"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={openPreview}
            isDisabled={busy}
          />
        </Stack>
      ) : null}

      {status === "in_review" && !approvedAll && !awaitingResend ? (
        <Stack gap="spacing.3">
          <Button
            title="Preview"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={openPreview}
            isDisabled={busy}
          />
          <Button
            title="Resend to all parties"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={confirmResendToAll}
            isDisabled={busy}
            isLoading={isResending}
          />
          <Alert color="notice" description="Editing will reset all approvals — everyone will need to review again." />
          <Button
            title="Edit draft"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={confirmEditDraft}
            isDisabled={busy}
          />
        </Stack>
      ) : null}

      {status === "in_review" && awaitingResend ? (
        <Stack gap="spacing.3">
          <Button
            title="Preview"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={openPreview}
            isDisabled={busy}
          />
          <Button
            title="Edit draft"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={confirmEditDraft}
            isDisabled={busy}
          />
        </Stack>
      ) : null}

      {status === "in_review" && approvedAll && !awaitingResend ? (
        <Stack gap="spacing.3">
          <Button
            title="Mark as sent for signing"
            isDisabled={busy}
            isLoading={statusMutation.isPending}
            onPress={() =>
              confirmStatus(
                "esign_sent",
                "Mark as sent for signing",
                "Confirm that you are sending this agreement for eSign outside TrustKeyper.",
              )
            }
          />
          <Button
            title="Preview"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={openPreview}
            isDisabled={busy}
          />
          <Button
            title="Resend to all parties"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={confirmResendToAll}
            isDisabled={busy}
            isLoading={isResending}
          />
        </Stack>
      ) : null}

      {status === "esign_sent" ? (
        <Stack gap="spacing.3">
          <Alert
            color="notice"
            title="Waiting for signature"
            description="The agreement is awaiting manual signing and stamping. You will be notified when the completed agreement is ready to download."
          />
          <Button
            title="Preview"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={openPreview}
            isDisabled={busy}
          />
        </Stack>
      ) : null}

      {status === "signed" ? (
        <Stack gap="spacing.3">
          <Alert
            color={hasSignedPdf ? "positive" : "notice"}
            title="Signed"
            description={
              hasSignedPdf
                ? "This agreement is complete. Download the signed PDF anytime."
                : "This agreement is marked signed, but its signed PDF has not been uploaded. Ask an administrator to upload the signed copy."
            }
          />
          {hasSignedPdf ? (
            <Button title="Download signed PDF" onPress={openSignedPdf} isDisabled={busy} />
          ) : null}
          <Button title="Renew" onPress={confirmRenew} isDisabled={busy} isLoading={renewMutation.isPending} />
          <Button
            title="Back to agreements"
            variant="secondary"
            textColor={theme.colors.primary}
            outlineColor={theme.colors.primary}
            onPress={goToAgreementsList}
          />
        </Stack>
      ) : null}
    </ScreenSafeArea>
  );
}

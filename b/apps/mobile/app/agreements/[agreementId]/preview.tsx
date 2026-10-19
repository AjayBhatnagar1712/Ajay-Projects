import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert as NativeAlert, View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import { WebView } from "react-native-webview";
import {
  buildLeaseAgreementPreviewHtml,
  downloadLeaseAgreementPreviewPdf,
} from "@/lib/agreements/preview";
import { previewBlockedBulletItems } from "@/lib/agreements/previewBlocked";
import {
  backToEntryLabel,
  createAgreementEntryHref,
  exitCreateAgreementToEntry,
  parseCreateAgreementEntry,
  pushCreateAgreementStep,
  type CreateAgreementEntry,
} from "@/lib/agreements/createAgreementNav";
import { capturePreviewEditSnapshot } from "@/lib/agreements/previewEditSession";
import { openReviewShareScreen } from "@/lib/agreements/reviewShare";
import {
  ApiError,
  getLeaseAgreement,
  sendLeaseAgreementReview,
} from "@/lib/api/client";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { quietElevation } from "@/lib/ui/elevation";
import { Stack } from "@/lib/ui/Stack";
import { Spinner } from "@/lib/ui/Spinner";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { StateScreen } from "@/lib/ui/StateScreen";
import { Text } from "@/lib/ui/Typography";

function routeId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isPreviewBlockedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 400;
}

function missingFromError(error: unknown): unknown {
  if (!(error instanceof ApiError)) return null;
  if (typeof error.body !== "object" || error.body === null) return null;
  if (!("missing" in error.body)) return null;
  return error.body.missing;
}

function PreviewBlockedState({
  message,
  missing,
  onEditDraft,
  onBackToEntry,
  entry,
}: {
  message: string;
  missing: unknown;
  onEditDraft: () => void;
  onBackToEntry: () => void;
  entry: CreateAgreementEntry;
}) {
  const theme = useAppTheme();
  const bullets = previewBlockedBulletItems(message, missing);

  return (
    <StateScreen
      tone="error"
      icon="alert-outline"
      title="This draft isn’t ready yet"
      primaryAction={{ title: "Edit draft", onPress: onEditDraft }}
      secondaryAction={{
        title: backToEntryLabel(entry),
        onPress: onBackToEntry,
      }}
    >
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={bullets.join(". ")}
        style={{ width: "100%", gap: 8, paddingHorizontal: 8 }}
      >
        {bullets.map((item) => (
          <View
            key={item}
            style={{
              width: "100%",
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <PaperText
              variant="bodyMedium"
              style={{
                color: theme.colors.onSurfaceVariant,
                fontFamily: fontFamilies.robotoRegular,
                lineHeight: 22,
              }}
            >
              •
            </PaperText>
            <PaperText
              variant="bodyMedium"
              style={{
                flex: 1,
                color: theme.colors.onSurfaceVariant,
                fontFamily: fontFamilies.robotoRegular,
                lineHeight: 22,
              }}
            >
              {item}
            </PaperText>
          </View>
        ))}
      </View>
    </StateScreen>
  );
}

function PreviewFailedState({
  message,
  onRetry,
  onEditDraft,
  onBackToEntry,
  entry,
}: {
  message: string;
  onRetry: () => void;
  onEditDraft: () => void;
  onBackToEntry: () => void;
  entry: CreateAgreementEntry;
}) {
  return (
    <StateScreen
      tone="error"
      icon="alert-circle-outline"
      title="Preview couldn’t be generated"
      description={message}
      primaryAction={{ title: "Retry", onPress: onRetry }}
      secondaryAction={{ title: "Edit draft", onPress: onEditDraft }}
      tertiaryAction={{
        title: backToEntryLabel(entry),
        onPress: onBackToEntry,
      }}
    />
  );
}

export default function LeaseAgreementPreviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{
    agreementId?: string | string[];
    entry?: string | string[];
  }>();
  const agreementId = routeId(params.agreementId);
  const entry = parseCreateAgreementEntry(params.entry);
  const entryHref = createAgreementEntryHref(entry);
  const [isPdfReady, setIsPdfReady] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const previewQuery = useQuery({
    queryKey: ["lease-agreement-preview", agreementId, openedAt],
    queryFn: async () => {
      setIsPdfReady(false);
      setPdfError(null);
      return await downloadLeaseAgreementPreviewPdf(agreementId ?? "");
    },
    enabled: agreementId !== undefined,
    refetchOnMount: "always",
  });

  const detailQuery = useQuery({
    queryKey: ["lease-agreement", agreementId],
    queryFn: () => getLeaseAgreement(agreementId ?? ""),
    enabled: agreementId !== undefined,
  });

  const isDraft = detailQuery.data?.status === "draft";

  async function editDraft(): Promise<void> {
    if (!agreementId) return;
    const detail = await queryClient.fetchQuery({
      queryKey: ["lease-agreement", agreementId],
      queryFn: () => getLeaseAgreement(agreementId),
    });
    capturePreviewEditSnapshot(detail);
    pushCreateAgreementStep(router, 1, entry, agreementId, "preview");
  }

  async function sendForReview(): Promise<void> {
    if (!agreementId || !detailQuery.data) return;
    setActionError(null);
    setIsSending(true);
    try {
      const result = await sendLeaseAgreementReview(agreementId);
      if (result.parties.length === 0) {
        setActionError("Could not create review links for the parties.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreement", agreementId] });
      openReviewShareScreen(
        router,
        queryClient,
        {
          agreementId,
          propertyAddress: detailQuery.data.propertyAddress ?? "the property",
          parties: result.parties,
        },
        "replace",
        entry,
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not send for review";
      setActionError(message);
    } finally {
      setIsSending(false);
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
          onPress: () => void sendForReview(),
        },
      ],
    );
  }

  function goToEntry(): void {
    exitCreateAgreementToEntry(router, entry);
  }

  if (!agreementId) {
    return (
      <ScreenSafeArea>
        <StackScreenHeader title="Preview" fallbackHref={entryHref} />
        <Alert description="No agreement was selected for preview." />
        <Button title={backToEntryLabel(entry)} onPress={goToEntry} />
      </ScreenSafeArea>
    );
  }

  if (previewQuery.isLoading) {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Preview" fallbackHref={entryHref} />
        <Stack gap="spacing.4">
          <Spinner accessibilityLabel="Generating agreement preview" />
          <Text color="subtle">Generating the latest PDF preview…</Text>
        </Stack>
      </ScreenSafeArea>
    );
  }

  if (previewQuery.error || !previewQuery.data) {
    const blocked = isPreviewBlockedError(previewQuery.error);
    const message =
      previewQuery.error?.message ?? "The agreement preview could not be generated.";

    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Preview" fallbackHref={entryHref} />
        {blocked ? (
          <PreviewBlockedState
            message={message}
            missing={missingFromError(previewQuery.error)}
            onEditDraft={() => void editDraft()}
            onBackToEntry={goToEntry}
            entry={entry}
          />
        ) : (
          <PreviewFailedState
            message={message}
            onRetry={() => void previewQuery.refetch()}
            onEditDraft={() => void editDraft()}
            onBackToEntry={goToEntry}
            entry={entry}
          />
        )}
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea scroll={false}>
      <StackScreenHeader title="Preview" fallbackHref={entryHref} />
      {actionError ? <Alert description={actionError} /> : null}
      {pdfError ? <Alert description={pdfError} /> : null}

      <View
        style={[
          quietElevation,
          {
            flex: 1,
            width: "100%",
            minHeight: 0,
            backgroundColor: theme.colors.surface,
            borderRadius: shape.radiusCard,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 8,
            overflow: "hidden",
          },
        ]}
        accessibilityLabel="Agreement document preview"
      >
        {!isPdfReady ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              zIndex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Spinner accessibilityLabel="Rendering agreement preview" />
            <Text color="subtle">Opening the generated PDF…</Text>
          </View>
        ) : null}
        <WebView
          originWhitelist={["*"]}
          source={{ html: buildLeaseAgreementPreviewHtml(previewQuery.data.base64) }}
          style={{
            flex: 1,
            width: "100%",
            backgroundColor: theme.colors.surface,
          }}
          onMessage={(event) => {
            try {
              const payload = JSON.parse(event.nativeEvent.data) as {
                type?: string;
                message?: string;
              };
              if (payload.type === "ready") {
                setIsPdfReady(true);
                setPdfError(null);
                return;
              }
              if (payload.type === "error") {
                setIsPdfReady(false);
                setPdfError(payload.message ?? "The PDF preview could not be rendered.");
              }
            } catch {
              setIsPdfReady(false);
              setPdfError("The PDF preview sent an unreadable response.");
            }
          }}
          onError={(event) => {
            setIsPdfReady(false);
            setPdfError(event.nativeEvent.description || "The PDF viewer could not open this file.");
          }}
          onHttpError={(event) => {
            setIsPdfReady(false);
            setPdfError(`The PDF preview failed to load (${event.nativeEvent.statusCode}).`);
          }}
        />
      </View>

      <Stack gap="spacing.3">
        {isDraft ? (
          <Button
            title="Send for review"
            onPress={confirmSendForReview}
            isDisabled={isSending || detailQuery.isLoading}
            isLoading={isSending}
          />
        ) : null}
        <View style={{ width: "100%", flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Edit draft"
              onPress={() => void editDraft()}
              variant="secondary"
              textColor={theme.colors.primary}
              outlineColor={theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="Refresh"
              onPress={() => void previewQuery.refetch()}
              variant="secondary"
              textColor={theme.colors.primary}
              outlineColor={theme.colors.primary}
            />
          </View>
        </View>
      </Stack>
    </ScreenSafeArea>
  );
}

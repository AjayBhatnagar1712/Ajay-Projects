import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import {
  listLeaseAgreements,
  type LeaseAgreement,
} from "@/lib/api/client";
import {
  agreementStatusLabel,
  agreementStatusSegment,
  formatAgreementDate,
  reviewProgressFromCounts,
  type AgreementStatusSegment,
} from "@/lib/agreements/flow";
import { useResumeAgreementCreation } from "@/lib/agreements/useResumeAgreementCreation";
import { useDerivedAlerts } from "@/lib/notifications/useDerivedAlerts";
import { filterAgreementsByAddress } from "@/lib/records/filterRecords";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { AgreementStatusChip } from "@/lib/ui/AgreementStatusChip";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { RecordCard } from "@/lib/ui/RecordCard";
import { RecordsSearchField } from "@/lib/ui/RecordsSearchField";
import { SegmentedControl } from "@/lib/ui/SegmentedControl";
import { ShellHeader } from "@/lib/ui/ShellHeader";
import { Spinner } from "@/lib/ui/Spinner";
import { StateScreen } from "@/lib/ui/StateScreen";
import { Text } from "@/lib/ui/Typography";
import { Row, Stack } from "@/lib/ui/Stack";

const TAB_EDGES = ["top", "left", "right"] as const;

const SEGMENTS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent for signing" },
  { value: "signed", label: "Signed" },
] as const;

function parseAgreementsSegment(
  raw: string | string[] | undefined,
): AgreementStatusSegment | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "draft" || value === "sent" || value === "signed") {
    return value;
  }
  return null;
}


const EMPTY_COPY: Record<
  AgreementStatusSegment,
  { title: string; description: string }
> = {
  draft: {
    title: "No drafts yet",
    description: "Agreements you start will appear here.",
  },
  sent: {
    title: "Nothing sent for signing yet",
    description: "Agreements awaiting signatures will appear here.",
  },
  signed: {
    title: "No signed agreements yet",
    description: "Completed agreements will appear here.",
  },
};

function AgreementListCard({
  agreement,
  showDraftActions,
  resumeId,
  onOpenDetail,
  onContinue,
  onPreview,
}: {
  agreement: LeaseAgreement;
  showDraftActions: boolean;
  resumeId: string | null;
  onOpenDetail: () => void;
  onContinue: () => void;
  onPreview: () => void;
}) {
  const theme = useAppTheme();
  const address = agreement.propertyAddress ?? "Property address not added";
  const createdLabel = `Created: ${formatAgreementDate(agreement.createdAt)}`;
  const progress =
    agreement.status === "in_review"
      ? reviewProgressFromCounts(agreement.partyCount, agreement.approvedCount)
      : null;

  const a11yParts = [
    address,
    `Status ${agreementStatusLabel(agreement.status)}`,
    createdLabel,
    progress ?? "",
  ].filter((part) => part.length > 0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yParts.join(". ")}
      accessibilityHint="Opens agreement details"
      onPress={onOpenDetail}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <RecordCard>
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <PaperText
            variant="titleMedium"
            style={{
              flex: 1,
              color: theme.colors.headingText,
              fontFamily: fontFamilies.generalSansSemibold,
            }}
          >
            {address}
          </PaperText>
          <AgreementStatusChip status={agreement.status} />
        </View>

        <PaperText
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          {createdLabel}
        </PaperText>

        {progress ? (
          <PaperText
            variant="labelMedium"
            accessibilityLabel={progress}
            style={{
              color: theme.colors.headingText,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            {progress}
          </PaperText>
        ) : null}

        {showDraftActions ? (
          <Row>
            <Button
              title="Continue"
              onPress={onContinue}
              isDisabled={resumeId !== null}
              isLoading={resumeId === agreement.id}
              isFullWidth={false}
            />
            <Button
              title="Preview"
              onPress={onPreview}
              variant="secondary"
              isDisabled={resumeId !== null}
              isFullWidth={false}
            />
          </Row>
        ) : null}
      </RecordCard>
    </Pressable>
  );
}

export default function AgreementsTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const [segment, setSegment] = useState<AgreementStatusSegment>("draft");
  const [searchQuery, setSearchQuery] = useState("");
  const { resumeId, resumeError, resumeAgreement } = useResumeAgreementCreation();
  const agreementsQuery = useQuery({
    queryKey: ["lease-agreements"],
    queryFn: listLeaseAgreements,
  });
  const { alerts, isLoading: alertsLoading } = useDerivedAlerts();

  // Home "See all" (and similar) pass ?segment=draft — apply on focus because
  // the Agreements tab may stay mounted with a prior segment selection.
  useFocusEffect(
    useCallback(() => {
      const next = parseAgreementsSegment(params.segment);
      if (next) {
        setSegment(next);
        setSearchQuery("");
      }
    }, [params.segment]),
  );

  const agreements = agreementsQuery.data?.leaseAgreements ?? [];
  const inSegment = useMemo(
    () =>
      agreements.filter(
        (agreement) => agreementStatusSegment(agreement.status) === segment,
      ),
    [agreements, segment],
  );
  const visible = useMemo(
    () => filterAgreementsByAddress(inSegment, searchQuery),
    [inSegment, searchQuery],
  );

  const isLoading = agreementsQuery.isLoading;
  const error = agreementsQuery.error;
  const catalogueEmpty = !isLoading && !error && inSegment.length === 0;
  const searchActive = searchQuery.trim().length > 0;
  const filteredEmpty =
    !isLoading && !error && !catalogueEmpty && searchActive && visible.length === 0;
  const showSearch = !isLoading && !error && !catalogueEmpty;
  const showList = !isLoading && !error && visible.length > 0;

  function onSegmentChange(value: string): void {
    setSegment(value as AgreementStatusSegment);
    setSearchQuery("");
  }

  function openDetail(agreementId: string): void {
    router.push({
      pathname: "/agreements/[agreementId]",
      params: { agreementId },
    });
  }

  return (
    <ScreenSafeArea
      edges={TAB_EDGES}
      refreshing={agreementsQuery.isRefetching && !agreementsQuery.isLoading}
      onRefresh={() => void agreementsQuery.refetch()}
    >
      <ShellHeader alerts={alerts} alertsLoading={alertsLoading} />

      <Button
        title="Create agreement"
        onPress={() =>
          router.push({
            pathname: "/(create-agreement)/property",
            params: { entry: "agreements" },
          })
        }
      />

      <SegmentedControl
        value={segment}
        options={SEGMENTS}
        onChange={onSegmentChange}
        accessibilityLabel="Agreement status"
      />

      {showSearch ? (
        <RecordsSearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by address"
          accessibilityLabel="Search agreements by address"
        />
      ) : null}

      {isLoading ? (
        <Stack gap="spacing.3">
          <Spinner accessibilityLabel="Loading agreements" />
          <Text color="subtle">Loading agreements…</Text>
        </Stack>
      ) : null}

      {error ? (
        <ErrorRecoveryActions onRetry={() => void agreementsQuery.refetch()} />
      ) : null}

      {resumeId ? <Text color="subtle">Loading saved progress…</Text> : null}
      {resumeError ? <Alert description={resumeError} /> : null}

      {catalogueEmpty ? (
        <StateScreen
          density="inline"
          icon="inbox-outline"
          title={EMPTY_COPY[segment].title}
          description={EMPTY_COPY[segment].description}
        />
      ) : null}

      {filteredEmpty ? (
        <StateScreen
          density="inline"
          icon="magnify"
          title="No results"
          description={`No results for “${searchQuery.trim()}”`}
        />
      ) : null}

      {showList ? (
        <View style={{ width: "100%", gap: 12 }}>
          {visible.map((agreement) => (
            <AgreementListCard
              key={agreement.id}
              agreement={agreement}
              showDraftActions={segment === "draft"}
              resumeId={resumeId}
              onOpenDetail={() => openDetail(agreement.id)}
              onContinue={() => void resumeAgreement(agreement.id, "agreements")}
              onPreview={() =>
                router.push({
                  pathname: "/agreements/[agreementId]/preview",
                  params: { agreementId: agreement.id, entry: "agreements" },
                })
              }
            />
          ))}
        </View>
      ) : null}
    </ScreenSafeArea>
  );
}

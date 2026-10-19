import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert as NativeAlert, Platform, Share, View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import {
  partyHasConfirmedShare,
  partyRoleLabel,
} from "@/lib/agreements/flow";
import {
  completeCreateAgreementToDetail,
  type CreateAgreementEntry,
} from "@/lib/agreements/createAgreementNav";
import {
  buildPartyShareMessage,
  reviewShareQueryKey,
  type ReviewSharePayload,
  type ReviewShareParty,
} from "@/lib/agreements/reviewShare";
import {
  confirmLeaseAgreementPartyReviewShared,
  getLeaseAgreement,
  type LeaseAgreementParty,
} from "@/lib/api/client";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { azure } from "@/lib/theme/colors";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { RecordCard } from "@/lib/ui/RecordCard";
import { Stack } from "@/lib/ui/Stack";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { Heading, Text } from "@/lib/ui/Typography";

function routeId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isLeasePartyRole(value: string): value is LeaseAgreementParty["role"] {
  return value === "owner" || value === "tenant";
}

function monogramLetter(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function PartyShareCard({
  party,
  alreadyShared,
  onShare,
}: {
  party: ReviewShareParty;
  alreadyShared: boolean;
  onShare: () => void;
}) {
  const theme = useAppTheme();
  const roleLabel = isLeasePartyRole(party.role)
    ? partyRoleLabel(party.role)
    : party.role;
  const letter = monogramLetter(party.name);

  return (
    <RecordCard
      accessibilityLabel={`${party.name}, ${roleLabel}. Review link ready to share.`}
    >
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          accessible
          accessibilityLabel={`${party.name} monogram`}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: azure[100],
          }}
        >
          <PaperText
            variant="titleMedium"
            style={{
              color: azure[900],
              fontFamily: fontFamilies.generalSansSemibold,
            }}
          >
            {letter}
          </PaperText>
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
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
            variant="labelSmall"
            style={{
              color: theme.colors.primary,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            {roleLabel}
          </PaperText>
          <PaperText
            variant="labelSmall"
            numberOfLines={1}
            ellipsizeMode="middle"
            accessibilityLabel={`Review link ${party.reviewLink}`}
            style={{
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoRegular,
            }}
          >
            {party.reviewLink}
          </PaperText>
          {alreadyShared ? (
            <Text color="subtle" size="small">
              Shared
            </Text>
          ) : null}
        </View>

        <Button
          title={alreadyShared ? "Share again" : "Share"}
          onPress={onShare}
          variant="tonal"
          isFullWidth={false}
        />
      </View>
    </RecordCard>
  );
}

export default function LeaseAgreementShareScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    agreementId?: string | string[];
    completionEntry?: string | string[];
  }>();
  const agreementId = routeId(params.agreementId);
  const rawCompletionEntry = routeId(params.completionEntry);
  const completionEntry: CreateAgreementEntry | undefined =
    rawCompletionEntry === "home" || rawCompletionEntry === "agreements"
      ? rawCompletionEntry
      : undefined;
  const [shareError, setShareError] = useState<string | null>(null);
  const [confirmedLocally, setConfirmedLocally] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const payload =
    agreementId === undefined
      ? undefined
      : queryClient.getQueryData<ReviewSharePayload>(reviewShareQueryKey(agreementId));

  const detailQuery = useQuery({
    queryKey: ["lease-agreement", agreementId],
    queryFn: () => getLeaseAgreement(agreementId ?? ""),
    enabled: agreementId !== undefined,
  });

  function isPartyShared(partyId: string): boolean {
    if (confirmedLocally.has(partyId)) return true;
    const serverParty = detailQuery.data?.parties.find((party) => party.id === partyId);
    if (!serverParty) return false;
    return partyHasConfirmedShare(serverParty);
  }

  function goToDetail(): void {
    if (!agreementId) {
      router.replace("/(tabs)/agreements");
      return;
    }
    if (completionEntry) {
      completeCreateAgreementToDetail(router, agreementId, completionEntry);
      return;
    }
    router.replace({
      pathname: "/agreements/[agreementId]",
      params: { agreementId },
    });
  }

  async function shareParty(party: ReviewShareParty): Promise<void> {
    if (!payload || !agreementId) return;
    setShareError(null);
    try {
      const result = await Share.share({
        message: buildPartyShareMessage(payload.propertyAddress, party),
      });
      if (Platform.OS === "ios" && result.action === Share.sharedAction) {
        await confirmLeaseAgreementPartyReviewShared(agreementId, party.id);
        setConfirmedLocally((prev) => new Set(prev).add(party.id));
        await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
        await queryClient.invalidateQueries({ queryKey: ["lease-agreement", agreementId] });
      }
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not open the share sheet");
    }
  }

  function handleDone(): void {
    if (Platform.OS === "android" && payload) {
      const unconfirmed = payload.parties.filter((party) => !isPartyShared(party.id));
      if (unconfirmed.length > 0) {
        NativeAlert.alert(
          "Some parties may not have received their link yet",
          "Continue anyway? Parties without a confirmed share will stay as not yet shared.",
          [
            { text: "Go back", style: "cancel" },
            { text: "Continue", onPress: goToDetail },
          ],
        );
        return;
      }
    }
    goToDetail();
  }

  if (!agreementId || !payload || payload.parties.length === 0) {
    return (
      <ScreenSafeArea>
        <StackScreenHeader title="Send for review" fallbackHref="/(tabs)/agreements" />
        <Alert description="No review links are ready to share. Send for review again from the agreement." />
        <Button title="Back to agreement" onPress={goToDetail} />
      </ScreenSafeArea>
    );
  }

  return (
    <ScreenSafeArea>
      <StackScreenHeader title="Send for review" fallbackHref="/(tabs)/agreements" />

      <Stack gap="spacing.3">
        <Heading size="large">Share with each party</Heading>
        <Text color="subtle">
          Send everyone their own link. They don’t need a TrustKeyper account to view or
          respond.
        </Text>
      </Stack>

      {shareError ? <Alert description={shareError} /> : null}

      <View style={{ width: "100%", gap: 12 }}>
        {payload.parties.map((party) => (
          <PartyShareCard
            key={party.id}
            party={party}
            alreadyShared={isPartyShared(party.id)}
            onShare={() => void shareParty(party)}
          />
        ))}
      </View>

      <Button title="Done" onPress={handleDone} variant="tertiary" />
    </ScreenSafeArea>
  );
}

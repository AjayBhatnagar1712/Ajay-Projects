import { formatPartyPhoneDisplay } from "@workspace/api-schemas";
import { View } from "react-native";
import { Text } from "react-native-paper";
import type { PartyContactSummary } from "@/lib/api/client";
import { useResumeAgreementCreation } from "@/lib/agreements/useResumeAgreementCreation";
import { partyAgreementRowKind } from "@/lib/records/partyAgreementRow";
import { propertyCountLabel } from "@/lib/records/formatRecordFields";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { RecordCard } from "@/lib/ui/RecordCard";

type Props = {
  party: PartyContactSummary;
};

/**
 * Owners/Tenants card — person header + grouped properties block.
 * Draft agreements show a continue CTA instead of placeholder addresses.
 */
export function PartyRecordCard({ party }: Props) {
  const theme = useAppTheme();
  const { resumeId, resumeError, resumeAgreement } = useResumeAgreementCreation();
  const phoneLine = formatPartyPhoneDisplay(party.phone);

  const a11yParts = [
    party.name,
    phoneLine,
    propertyCountLabel(party.agreementCount),
    ...party.agreements.map((agreement) => {
      const kind = partyAgreementRowKind(agreement);
      if (kind === "draft") return "Continue setting up this agreement";
      if (kind === "address") return agreement.propertyAddress?.trim() ?? "";
      return "";
    }),
  ].filter((part) => part.length > 0);
  if (party.alternateNames.length > 0) {
    a11yParts.push(`Also recorded as ${party.alternateNames.join(", ")}`);
  }

  const hasAgreementRows = party.agreements.some(
    (agreement) => partyAgreementRowKind(agreement) !== "omit",
  );

  return (
    <RecordCard accessibilityLabel={a11yParts.join(". ")}>
      <View style={{ width: "100%", gap: 4 }}>
        <Text
          variant="titleMedium"
          style={{
            color: theme.colors.headingText,
            fontFamily: fontFamilies.generalSansSemibold,
          }}
        >
          {party.name}
        </Text>
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          {phoneLine}
        </Text>
        {party.alternateNames.length > 0 ? (
          <Text
            variant="bodySmall"
            style={{
              marginTop: 2,
              color: theme.colors.mutedText,
              fontFamily: fontFamilies.robotoRegular,
            }}
          >
            Also recorded as {party.alternateNames.join(", ")}
          </Text>
        ) : null}
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
        <Text
          variant="labelMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoMedium,
            letterSpacing: 0.2,
            textTransform: "uppercase",
          }}
        >
          {propertyCountLabel(party.agreementCount)}
        </Text>

        {resumeError ? <Alert description={resumeError} /> : null}

        {hasAgreementRows ? (
          <View
            style={{
              width: "100%",
              borderLeftWidth: 3,
              borderLeftColor: theme.colors.primary,
              paddingLeft: 12,
              gap: 12,
            }}
          >
            {party.agreements.map((agreement) => {
              const kind = partyAgreementRowKind(agreement);
              if (kind === "draft") {
                const loading = resumeId === agreement.agreementId;
                return (
                  <View
                    key={agreement.agreementId}
                    style={{ width: "100%", gap: 8 }}
                  >
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.bodyText,
                        fontFamily: fontFamilies.robotoRegular,
                      }}
                    >
                      Continue setting up this agreement
                    </Text>
                    <Button
                      title="Continue"
                      onPress={() =>
                        void resumeAgreement(agreement.agreementId, "agreements")
                      }
                      isDisabled={resumeId !== null}
                      isLoading={loading}
                      isFullWidth={false}
                    />
                  </View>
                );
              }

              if (kind === "omit") return null;

              return (
                <Text
                  key={agreement.agreementId}
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.bodyText,
                    fontFamily: fontFamilies.robotoRegular,
                  }}
                >
                  {agreement.propertyAddress?.trim()}
                </Text>
              );
            })}
          </View>
        ) : null}
      </View>
    </RecordCard>
  );
}

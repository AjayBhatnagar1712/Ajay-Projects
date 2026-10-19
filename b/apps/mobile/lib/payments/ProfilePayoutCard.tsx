import { useRouter, type Href } from "expo-router";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Button } from "@/lib/ui/Button";
import { RecordDetailRow } from "@/lib/ui/RecordCard";
import { TintedSectionCard } from "@/lib/ui/TintedSectionCard";
import { Stack } from "@/lib/ui/Stack";
import { maskBankAccountLast4 } from "@/lib/payments/maskBankAccount";
import type { PayoutSetupView } from "@/lib/payments/payoutStatus";

type Props = {
  view: PayoutSetupView;
  bankAccountLast4: string | null | undefined;
  isLoading: boolean;
};

function subHeading(title: string, color: string) {
  return (
    <Text
      variant="labelMedium"
      style={{
        color,
        fontFamily: fontFamilies.robotoMedium,
        letterSpacing: 0.5,
        textTransform: "uppercase",
      }}
    >
      {title}
    </Text>
  );
}

/**
 * Profile payout card — same TintedSectionCard recipe as broker-details.
 * Status-aware: start CTA, verification in progress, or masked bank confirmation.
 */
export function ProfilePayoutCard({
  view,
  bankAccountLast4,
  isLoading,
}: Props) {
  const theme = useAppTheme();
  const router = useRouter();
  const masked = maskBankAccountLast4(bankAccountLast4);

  if (isLoading) {
    return (
      <TintedSectionCard>
        {subHeading("Payout Details", theme.colors.primary)}
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          Checking payout status…
        </Text>
      </TintedSectionCard>
    );
  }

  if (view === "active") {
    return (
      <TintedSectionCard>
        {subHeading("Payout Details", theme.colors.primary)}
        <Stack gap="spacing.3">
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.bodyText,
              fontFamily: fontFamilies.robotoRegular,
            }}
          >
            Your payout details are verified. You can receive consultancy fees.
          </Text>
          {masked ? (
            <RecordDetailRow label="Bank account" value={masked} />
          ) : null}
          <Button
            title="Change payout details"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/payout-setup",
                params: { edit: "1" },
              } as Href)
            }
          />
        </Stack>
      </TintedSectionCard>
    );
  }

  if (view === "pending") {
    return (
      <TintedSectionCard>
        {subHeading("Payout Details", theme.colors.primary)}
        <Stack gap="spacing.3">
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.bodyText,
              fontFamily: fontFamilies.robotoRegular,
            }}
          >
            Verification in progress
          </Text>
          <Button
            title="Update payout details"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: "/payout-setup",
                params: { edit: "1" },
              } as Href)
            }
          />
        </Stack>
      </TintedSectionCard>
    );
  }

  const ctaTitle =
    view === "failed" ? "Update payout details" : "Set up payout details";
  const description =
    view === "failed"
      ? "We could not verify your payout details. Please review and submit again."
      : "Add your bank details to receive consultancy fees.";

  return (
    <TintedSectionCard>
      {subHeading("Payout Details", theme.colors.primary)}
      <View style={{ width: "100%", gap: 12 }}>
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.bodyText,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          {description}
        </Text>
        <Button
          title={ctaTitle}
          onPress={() => router.push("/payout-setup" as Href)}
        />
      </View>
    </TintedSectionCard>
  );
}

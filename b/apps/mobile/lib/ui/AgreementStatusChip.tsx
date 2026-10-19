import { View } from "react-native";
import { Text } from "react-native-paper";
import { agreementStatusLabel } from "@/lib/agreements/flow";
import { azure, emerald, interimWarning, semantic } from "@/lib/theme/colors";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";

type Props = {
  status: string;
};

function chipColors(status: string): { background: string; text: string } {
  if (status === "signed" || status === "completed") {
    return { background: emerald[50], text: semantic.onSuccess };
  }
  if (status === "in_review" || status === "signing") {
    return { background: azure[100], text: azure[900] };
  }
  if (
    status === "esign_sent" ||
    status === "sent" ||
    status === "sent_for_signing"
  ) {
    return {
      background: interimWarning.warningContainer,
      text: interimWarning.onWarningContainer,
    };
  }
  return { background: azure[50], text: azure[800] };
}

/**
 * Compact status label for agreement list/detail — theme fills, chip radius.
 */
export function AgreementStatusChip({ status }: Props) {
  const label = agreementStatusLabel(status);
  const colors = chipColors(status);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status ${label}`}
      style={{
        alignSelf: "flex-start",
        flexShrink: 0,
        backgroundColor: colors.background,
        borderRadius: shape.radiusChip,
        paddingHorizontal: 10,
        paddingVertical: 4,
        minHeight: 28,
        justifyContent: "center",
      }}
    >
      <Text
        variant="labelMedium"
        style={{
          color: colors.text,
          fontFamily: fontFamilies.robotoMedium,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import type { AutosaveStatus } from "./useAgreementStepAutosave";

/**
 * Unobtrusive footer cue that work is persisting without an explicit Save.
 * Idle renders nothing so it doesn't compete with validation alerts.
 */
export function AutosaveStatusLabel({ status }: { status: AutosaveStatus }) {
  const theme = useAppTheme();

  if (status === "idle") return null;

  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : "Couldn't save — keep editing";

  const color =
    status === "error" ? theme.colors.error : theme.colors.onSurfaceVariant;

  return (
    <Text
      variant="labelSmall"
      accessibilityLiveRegion="polite"
      style={{
        alignSelf: "center",
        color,
        fontFamily: fontFamilies.robotoRegular,
      }}
    >
      {label}
    </Text>
  );
}

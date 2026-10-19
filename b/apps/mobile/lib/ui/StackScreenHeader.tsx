import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "react-native-paper";
import { goBackOrFallback } from "@/lib/navigation/goBackOrFallback";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { StackBackButton } from "@/lib/ui/StackBackButton";

type Props = {
  title: string;
  /** Fallback when the stack cannot go back (ignored when `onBack` is set). */
  fallbackHref?: Href;
  /**
   * Custom back handler (create-agreement in-flow / entry exit).
   * When set, skips the default canGoBack / fallbackHref path.
   */
  onBack?: () => void;
  /** When true, back chevron is non-interactive (submit / cancel in flight). */
  backDisabled?: boolean;
  /**
   * Optional trailing control (e.g. create-agreement Cancel). Title keeps
   * `flex: 1` + ellipsis so long labels don't overlap Back or the right slot.
   */
  right?: ReactNode;
};

/**
 * Standard stack header: top-left back chevron + title (+ optional right).
 * Matches AuthScreenLayout / other pushed screens — not a slide-in overlay.
 */
export function StackScreenHeader({
  title,
  fallbackHref = "/(tabs)/home",
  onBack,
  backDisabled = false,
  right,
}: Props) {
  const theme = useAppTheme();
  const router = useRouter();

  function goBack(): void {
    if (backDisabled) return;
    if (onBack) {
      onBack();
      return;
    }
    goBackOrFallback(router, () => {
      router.replace(fallbackHref);
    });
  }

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        minHeight: 48,
        marginBottom: 8,
        gap: 8,
      }}
    >
      <View
        pointerEvents={backDisabled ? "none" : "auto"}
        style={{ opacity: backDisabled ? 0.5 : 1 }}
      >
        <StackBackButton onPress={goBack} />
      </View>
      <Text
        variant="titleLarge"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          flex: 1,
          minWidth: 0,
          color: theme.colors.headingText,
          fontFamily: fontFamilies.generalSansSemibold,
        }}
      >
        {title}
      </Text>
      {right ? (
        <View style={{ flexShrink: 0, maxWidth: "40%" }}>{right}</View>
      ) : null}
    </View>
  );
}

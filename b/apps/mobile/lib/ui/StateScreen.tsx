import type { ReactNode } from "react";
import { View } from "react-native";
import { Icon, Text as PaperText } from "react-native-paper";
import { azure } from "@/lib/theme/colors";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Button } from "@/lib/ui/Button";
import { Stack } from "@/lib/ui/Stack";

export type StateScreenTone = "neutral" | "error";

export type StateScreenAction = {
  title: string;
  onPress: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
};

type Props = {
  /** Material Community Icons name. */
  icon: string;
  title: string;
  description?: string;
  /** Extra body (e.g. bullet list) below the description. */
  children?: ReactNode;
  primaryAction?: StateScreenAction;
  /** Text-style secondary (e.g. Sign out / Edit draft). */
  secondaryAction?: StateScreenAction;
  /** Additional text-style action below secondary (e.g. Back to origin). */
  tertiaryAction?: StateScreenAction;
  tone?: StateScreenTone;
  /**
   * `screen` — full-bleed centered (session / connection).
   * `inline` — list empty / no-results nestled under chrome.
   */
  density?: "screen" | "inline";
};

const ICON_SIZE = 64;

/**
 * Shared empty / error state: tinted circular icon, headline, supporting text,
 * optional actions. Announce the message for screen readers (role=alert when
 * tone is error; status otherwise).
 */
export function StateScreen({
  icon,
  title,
  description,
  children,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  tone = "neutral",
  density = "screen",
}: Props) {
  const theme = useAppTheme();
  const isError = tone === "error";
  const iconBackground = isError ? theme.colors.errorContainer : azure[100];
  const iconColor = isError ? theme.colors.error : azure[800];
  const titleVariant = density === "inline" ? "titleLarge" : "headlineSmall";
  const descriptionVariant = density === "inline" ? "bodyMedium" : "bodyLarge";
  const a11yLabel = [title, description].filter(Boolean).join(". ");

  return (
    <View
      accessible
      accessibilityRole={isError ? "alert" : "summary"}
      accessibilityLabel={a11yLabel}
      accessibilityLiveRegion={isError ? "assertive" : "polite"}
      style={{
        width: "100%",
        alignItems: "center",
        justifyContent: density === "screen" ? "center" : "flex-start",
        paddingVertical: density === "inline" ? 40 : 24,
        paddingHorizontal: density === "inline" ? 8 : 0,
        gap: density === "inline" ? 16 : 24,
      }}
    >
      <View
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: ICON_SIZE,
          height: ICON_SIZE,
          borderRadius: ICON_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: iconBackground,
        }}
      >
        <Icon source={icon} size={32} color={iconColor} />
      </View>

      <View style={{ width: "100%", gap: density === "inline" ? 8 : 12, alignItems: "center" }}>
        <PaperText
          variant={titleVariant}
          style={{
            textAlign: "center",
            color: isError ? theme.colors.error : theme.colors.headingText,
            fontFamily: fontFamilies.generalSansSemibold,
            width: "100%",
          }}
        >
          {title}
        </PaperText>
        {description ? (
          <PaperText
            variant={descriptionVariant}
            style={{
              textAlign: "center",
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoRegular,
              width: "100%",
            }}
          >
            {description}
          </PaperText>
        ) : null}
        {children}
      </View>

      {primaryAction || secondaryAction || tertiaryAction ? (
        <Stack gap="spacing.3">
          {primaryAction ? (
            <Button
              title={primaryAction.title}
              onPress={primaryAction.onPress}
              isLoading={primaryAction.isLoading}
              isDisabled={primaryAction.isDisabled}
            />
          ) : null}
          {secondaryAction ? (
            <Button
              title={secondaryAction.title}
              onPress={secondaryAction.onPress}
              variant="tertiary"
              isLoading={secondaryAction.isLoading}
              isDisabled={secondaryAction.isDisabled}
            />
          ) : null}
          {tertiaryAction ? (
            <Button
              title={tertiaryAction.title}
              onPress={tertiaryAction.onPress}
              variant="tertiary"
              isLoading={tertiaryAction.isLoading}
              isDisabled={tertiaryAction.isDisabled}
            />
          ) : null}
        </Stack>
      ) : null}
    </View>
  );
}

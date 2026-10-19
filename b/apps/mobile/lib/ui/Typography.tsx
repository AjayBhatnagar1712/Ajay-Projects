import type { ReactNode } from "react";
import { Text as PaperText } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";

type TextProps = {
  children: ReactNode;
  size?: "small" | "medium" | "large";
  color?: "primary" | "subtle" | "negative";
  weight?: "regular" | "medium" | "semibold";
};

const TEXT_VARIANT = {
  small: "bodySmall",
  medium: "bodyMedium",
  large: "bodyLarge",
} as const;

export function Text({
  children,
  size = "medium",
  color = "primary",
  weight = "regular",
}: TextProps) {
  const theme = useAppTheme();
  const textColor =
    color === "subtle"
      ? theme.colors.onSurfaceVariant
      : color === "negative"
        ? theme.colors.error
        : theme.colors.bodyText;

  // Body stack is Roboto 400/500 only — map semibold → medium.
  const fontFamily =
    weight === "regular"
      ? fontFamilies.robotoRegular
      : fontFamilies.robotoMedium;

  return (
    <PaperText
      variant={TEXT_VARIANT[size]}
      style={{ color: textColor, fontFamily, flexShrink: 1 }}
    >
      {children}
    </PaperText>
  );
}

type HeadingProps = {
  children: ReactNode;
  size?: "small" | "medium" | "large" | "xlarge";
};

const HEADING_VARIANT = {
  small: "titleMedium",
  medium: "titleLarge",
  large: "headlineMedium",
  /** Auth screens — Figma ~32px headline */
  xlarge: "headlineLarge",
} as const;

export function Heading({ children, size = "medium" }: HeadingProps) {
  const theme = useAppTheme();
  const variant = HEADING_VARIANT[size];

  return (
    <PaperText
      variant={variant}
      style={{
        color: theme.colors.headingText,
        fontFamily: theme.fonts[variant].fontFamily,
        width: "100%",
        flexShrink: 1,
      }}
    >
      {children}
    </PaperText>
  );
}

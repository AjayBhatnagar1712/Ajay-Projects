import type { ReactNode } from "react";
import { View } from "react-native";

type Spacing = "spacing.3" | "spacing.4" | "spacing.5" | "spacing.6" | "spacing.7";

const SPACING_PX: Record<Spacing, number> = {
  "spacing.3": 8,
  "spacing.4": 12,
  "spacing.5": 16,
  "spacing.6": 20,
  "spacing.7": 24,
};

type Props = {
  children: ReactNode;
  gap?: Spacing;
  padding?: "spacing.4" | "spacing.5" | "spacing.6";
  /** Fill parent height (non-scroll screens that need flex children). */
  fill?: boolean;
};

/** Vertical stack layout — presentation only. */
export function Stack({ children, gap = "spacing.4", padding, fill = false }: Props) {
  return (
    <View
      style={{
        flexDirection: "column",
        gap: SPACING_PX[gap],
        padding: padding ? SPACING_PX[padding] : undefined,
        width: "100%",
        flex: fill ? 1 : undefined,
        minHeight: fill ? 0 : undefined,
      }}
    >
      {children}
    </View>
  );
}

type RowProps = {
  children: ReactNode;
  gap?: "spacing.3" | "spacing.4" | "spacing.5";
};

export function Row({ children, gap = "spacing.3" }: RowProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: SPACING_PX[gap],
        alignItems: "center",
      }}
    >
      {children}
    </View>
  );
}

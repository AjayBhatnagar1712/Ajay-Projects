import type { ReactNode } from "react";
import { Platform, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView, type Edge, useSafeAreaInsets } from "react-native-safe-area-context";
import { FLOATING_TAB_BAR_CONTENT_INSET } from "@/lib/shell/floatingTabBar";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import {
  FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS,
  formScrollKeyboardDismissMode,
} from "@/lib/ui/formScrollKeyboard";
import { Stack } from "@/lib/ui/Stack";

type ScreenSafeAreaProps = {
  children: ReactNode;
  /** Defaults to all edges. Tab screens typically omit bottom (tab bar handles it). */
  edges?: readonly Edge[];
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra bottom inset for the floating pill tab bar (default true when bottom edge omitted). */
  tabBarClearance?: boolean;
  /**
   * Override page fill. Defaults to `theme.colors.background` (#FFFFFF).
   */
  backgroundColor?: string;
};

/** Safe-area + padded stack. Styling only — no business logic. */
export function ScreenSafeArea({
  children,
  edges,
  scroll = true,
  refreshing = false,
  onRefresh,
  tabBarClearance,
  backgroundColor,
}: ScreenSafeAreaProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const omitBottom = edges !== undefined && !edges.includes("bottom");
  const clearTabBar = tabBarClearance ?? omitBottom;
  const bottomPad = clearTabBar
    ? FLOATING_TAB_BAR_CONTENT_INSET + Math.max(insets.bottom, 8)
    : 0;
  const pageBackground = backgroundColor ?? theme.colors.background;

  const content = (
    <Stack gap="spacing.5" padding="spacing.5" fill={!scroll}>
      {children}
    </Stack>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: pageBackground }}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps={FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS}
          keyboardDismissMode={formScrollKeyboardDismissMode(Platform.OS)}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomPad }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
                progressBackgroundColor={theme.colors.surface}
              />
            ) : undefined
          }
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, width: "100%", paddingBottom: bottomPad }}>
          {content}
        </View>
      )}
    </SafeAreaView>
  );
}

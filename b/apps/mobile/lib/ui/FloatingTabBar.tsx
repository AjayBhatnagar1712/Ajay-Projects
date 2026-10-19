import type { ComponentProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs } from "expo-router";
import { Animated, LayoutChangeEvent, Pressable, View } from "react-native";
import { Icon, Text } from "react-native-paper";
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_HORIZONTAL,
  FLOATING_TAB_BAR_MARGIN,
} from "@/lib/shell/floatingTabBar";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { quietElevationStrong } from "@/lib/ui/elevation";

type TabBarRender = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type FloatingTabBarProps = Parameters<TabBarRender>[0];

const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
  home: { active: "home", inactive: "home-outline" },
  agreements: { active: "file-document", inactive: "file-document-outline" },
  records: { active: "notebook", inactive: "notebook-outline" },
  payments: { active: "cash", inactive: "cash-outline" },
  profile: { active: "account", inactive: "account-outline" },
};

/**
 * Outer bar pad and per-slot sub-pill inset must match so:
 *   outer_gap (bar edge → first/last pill) = BAR_PAD_H + SUB_PILL_INSET_H
 *   inter_gap (pill → pill)                = 2 × SUB_PILL_INSET_H
 * Equal when BAR_PAD_H === SUB_PILL_INSET_H.
 *
 * Indicator x/width from measured tab-row width ÷ count (equal math).
 */
const BAR_PAD_H = 4;
const SUB_PILL_INSET_H = 4;
const SUB_PILL_INSET_V = 8;

/**
 * Floating capsule tab bar with a sliding sub-pill behind the active tab.
 */
export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset =
    insets.bottom > 0
      ? insets.bottom
      : (initialWindowMetrics?.insets.bottom ?? 0);
  const bottomOffset = bottomInset + FLOATING_TAB_BAR_MARGIN;
  const capsuleRadius = FLOATING_TAB_BAR_HEIGHT / 2;

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter((route) => {
        const options = descriptors[route.key]?.options ?? {};
        if ("href" in options && options.href === null) return false;
        return true;
      }),
    [state.routes, descriptors],
  );

  const focusedVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((route) => state.routes[state.index]?.key === route.key),
  );

  const [rowWidth, setRowWidth] = useState(0);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorW = useRef(new Animated.Value(0)).current;
  const hasPlaced = useRef(false);

  function onRowLayout(event: LayoutChangeEvent): void {
    setRowWidth(event.nativeEvent.layout.width);
  }

  const tabCount = Math.max(1, visibleRoutes.length);
  const slotW = rowWidth / tabCount;
  const subPillHeight = FLOATING_TAB_BAR_HEIGHT - SUB_PILL_INSET_V * 2;
  const subPillTop = SUB_PILL_INSET_V;
  const targetW = Math.max(0, slotW - SUB_PILL_INSET_H * 2);
  const targetX = focusedVisibleIndex * slotW + SUB_PILL_INSET_H;

  useEffect(() => {
    if (rowWidth <= 0 || targetW <= 0) return;

    if (!hasPlaced.current) {
      indicatorX.setValue(targetX);
      indicatorW.setValue(targetW);
      hasPlaced.current = true;
      return;
    }

    Animated.parallel([
      Animated.spring(indicatorX, {
        toValue: targetX,
        useNativeDriver: false,
        speed: 18,
        bounciness: 6,
      }),
      Animated.spring(indicatorW, {
        toValue: targetW,
        useNativeDriver: false,
        speed: 18,
        bounciness: 6,
      }),
    ]).start();
  }, [rowWidth, targetX, targetW, indicatorX, indicatorW]);

  const showIndicator = rowWidth > 0 && targetW > 0;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: FLOATING_TAB_BAR_HORIZONTAL,
        paddingBottom: bottomOffset,
      }}
    >
      <View
        style={[
          quietElevationStrong,
          {
            height: FLOATING_TAB_BAR_HEIGHT,
            borderRadius: capsuleRadius,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: BAR_PAD_H,
            overflow: "hidden",
          },
        ]}
      >
        <View
          onLayout={onRowLayout}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "stretch",
          }}
        >
          {showIndicator ? (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: subPillTop,
                height: subPillHeight,
                borderRadius: subPillHeight / 2,
                backgroundColor: theme.colors.primaryContainer,
                left: indicatorX,
                width: indicatorW,
              }}
            />
          ) : null}

          {visibleRoutes.map((route) => {
            const focused =
              state.routes[state.index]?.key === route.key ||
              visibleRoutes[focusedVisibleIndex]?.key === route.key;
            const options = descriptors[route.key]?.options ?? {};
            const label =
              typeof options.tabBarLabel === "string"
                ? options.tabBarLabel
                : typeof options.title === "string"
                  ? options.title
                  : route.name;
            const icons = TAB_ICONS[route.name] ?? {
              active: "circle",
              inactive: "circle-outline",
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={() => {
                  const event = navigation.emit({
                    type: "tabPress",
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  zIndex: 1,
                }}
              >
                <Icon
                  source={focused ? icons.active : icons.inactive}
                  size={22}
                  color={
                    focused
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant
                  }
                />
                <Text
                  variant="labelSmall"
                  style={{
                    color: focused
                      ? theme.colors.primary
                      : theme.colors.onSurfaceVariant,
                    fontFamily: fontFamilies.robotoMedium,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

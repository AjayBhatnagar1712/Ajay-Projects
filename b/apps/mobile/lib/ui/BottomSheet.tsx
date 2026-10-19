import { useEffect, useRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import {
  BOTTOM_SHEET_ENTER_MS,
  BOTTOM_SHEET_OFFSCREEN_Y,
  isSheetEnterPending,
} from "@/lib/ui/bottomSheetEnter";
import { useAndroidOverlayKeyboardBottomInset } from "@/lib/ui/useAndroidOverlayKeyboardBottomInset";

export { BOTTOM_SHEET_ENTER_MS } from "@/lib/ui/bottomSheetEnter";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  /** Fires after the slide-up finishes — use to focus fields without racing the keyboard. */
  onEntered?: () => void;
};

/**
 * Content-sized drawer that slides up over a dimmed backdrop.
 *
 * Enter animation is a measured translateY (sheet height → 0), not Reanimated
 * `SlideInUp`. That preset uses `windowHeight` as originY and races the first
 * Modal layout (often y=0 at the top) plus Android keyboard resize — which is
 * why Edit looked like it dropped from the top and landed behind the keyboard.
 *
 * Keyboard: iOS KeyboardAvoidingView; Android always pads by keyboard height
 * (overlay policy — Activity adjustResize does not shrink this Dialog).
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  accessibilityLabel,
  onEntered,
}: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const androidKeyboardInset = useAndroidOverlayKeyboardBottomInset();
  const translateY = useSharedValue(BOTTOM_SHEET_OFFSCREEN_Y);
  const onEnteredRef = useRef(onEntered);
  onEnteredRef.current = onEntered;
  const pendingEnterRef = useRef(false);
  const wasVisibleRef = useRef(false);

  // Ref-only during render (allowed) so onLayout sees the open in this
  // commit. Do not write translateY.value here — Reanimated strict mode
  // treats that as a render-time shared-value write.
  pendingEnterRef.current = isSheetEnterPending(
    visible,
    wasVisibleRef.current,
    pendingEnterRef.current,
  );
  wasVisibleRef.current = visible;

  useEffect(() => {
    if (!visible) {
      translateY.value = BOTTOM_SHEET_OFFSCREEN_Y;
      return;
    }
    const timer = setTimeout(() => {
      onEnteredRef.current?.();
    }, BOTTOM_SHEET_ENTER_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [visible, translateY]);

  function handleSheetLayout(event: LayoutChangeEvent): void {
    const height = event.nativeEvent.layout.height;
    if (!visible || !pendingEnterRef.current || height <= 0) return;
    pendingEnterRef.current = false;
    translateY.value = height;
    translateY.value = withTiming(0, { duration: BOTTOM_SHEET_ENTER_MS });
  }

  const sheetMotionStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.frame}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onClose}
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: theme.colors.backdrop },
            ]}
          />
          <Animated.View
            onLayout={handleSheetLayout}
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            style={[
              sheetMotionStyle,
              {
                backgroundColor: theme.colors.surface,
                borderTopLeftRadius: shape.radiusCard,
                borderTopRightRadius: shape.radiusCard,
                paddingBottom: Math.max(insets.bottom, 12) + androidKeyboardInset,
                maxHeight: "90%",
              },
            ]}
          >
            <View style={styles.handleWrap} pointerEvents="none">
              <View
                style={[
                  styles.handle,
                  { backgroundColor: theme.colors.outline },
                ]}
              />
            </View>
            {children}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  frame: {
    flex: 1,
    justifyContent: "flex-end",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
});

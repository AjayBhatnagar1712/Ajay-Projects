import type { ReactNode, Ref, RefObject } from "react";
import { useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ScrollViewProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import { registerFormScroll } from "@/lib/ui/formScrollRegistry";
import {
  FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS,
  formScrollKeyboardDismissMode,
} from "@/lib/ui/formScrollKeyboard";
import { scrollDeltaToRevealField } from "@/lib/ui/scrollDeltaToRevealField";
import { useAndroidKeyboardBottomInset } from "@/lib/ui/useAndroidKeyboardBottomInset";

type Props = {
  children: ReactNode;
  footer?: ReactNode;
  /** Forwarded so parents can scroll to validation errors. */
  scrollRef?: Ref<ScrollView>;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (ref == null) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  (ref as RefObject<T | null>).current = value;
}

/**
 * Create-agreement chrome: scrollable body + pinned footer (primary CTA / Back / Cancel).
 *
 * iOS: KeyboardAvoidingView padding lifts the pinned footer above the keyboard.
 * Android: useAndroidKeyboardBottomInset pads the footer when the window did
 * not shrink for the keyboard (Expo Go / edge-to-edge overlay). When
 * softwareKeyboardLayoutMode=resize actually shrinks the window (custom builds),
 * inset stays 0 so we do not double-count. Parties / onboarding / inventory all
 * share this layout — there is no separate parties keyboard path.
 *
 * ScrollView keyboard: persist taps + do not dismiss on scroll
 * (see formScrollKeyboard). Onboarding and create-agreement both use this.
 */
export function CreationStepLayout({
  children,
  footer,
  scrollRef,
  contentContainerStyle,
}: Props) {
  const theme = useAppTheme();
  const androidKeyboardInset = useAndroidKeyboardBottomInset();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    registerFormScroll({
      scrollFieldIntoView: (field: FieldFocusHandle) => {
        const scroll = scrollViewRef.current;
        if (!scroll || !field.measureInWindow) return;
        field.measureInWindow((_fx, fy, _fw, fh) => {
          const measureScroll = scroll as ScrollView & {
            measureInWindow: (
              callback: (
                x: number,
                y: number,
                width: number,
                height: number,
              ) => void,
            ) => void;
          };
          measureScroll.measureInWindow((_sx, sy, _sw, sh) => {
            const delta = scrollDeltaToRevealField({
              fieldY: fy,
              fieldHeight: fh,
              scrollViewY: sy,
              scrollViewHeight: sh,
            });
            if (delta === 0) return;
            scroll.scrollTo({
              y: Math.max(0, scrollYRef.current + delta),
              animated: true,
            });
          });
        });
      },
    });
    return () => {
      registerFormScroll(null);
    };
  }, []);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, width: "100%", paddingHorizontal: 24 }}>
          <ScrollView
            ref={(node) => {
              scrollViewRef.current = node;
              assignRef(scrollRef, node);
            }}
            style={{ flex: 1, width: "100%" }}
            contentContainerStyle={[
              {
                flexGrow: 1,
                paddingTop: 12,
                paddingBottom: 16,
                gap: 20,
              },
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps={FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS}
            keyboardDismissMode={formScrollKeyboardDismissMode(Platform.OS)}
            onScroll={(event) => {
              scrollYRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                width: "100%",
                paddingTop: 12,
                paddingBottom: 16 + androidKeyboardInset,
                gap: 12,
                alignItems: "center",
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

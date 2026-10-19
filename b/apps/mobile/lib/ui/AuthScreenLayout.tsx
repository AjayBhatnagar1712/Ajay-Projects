import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import {
  FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS,
  formScrollKeyboardDismissMode,
} from "@/lib/ui/formScrollKeyboard";
import { StackBackButton } from "@/lib/ui/StackBackButton";
import { useAndroidKeyboardBottomInset } from "@/lib/ui/useAndroidKeyboardBottomInset";

type Props = {
  children: ReactNode;
  footer: ReactNode;
  onBack?: () => void;
  /** When false, hides the back control (e.g. first auth step if unused). */
  showBack?: boolean;
};

/**
 * Auth screen chrome matching Figma structure (content + bottom CTA),
 * without device status-bar mock. Colors/spacing from theme.
 *
 * Keyboard:
 * - iOS: KeyboardAvoidingView behavior=padding lifts the pinned footer.
 * - Android: useAndroidKeyboardBottomInset pads the footer when the window did
 *   not resize for the keyboard (see androidKeyboardInsetFromHeight).
 * Content ScrollView: persist taps + do not dismiss keyboard on scroll
 * (see formScrollKeyboard).
 */
export function AuthScreenLayout({
  children,
  footer,
  onBack,
  showBack = true,
}: Props) {
  const theme = useAppTheme();
  const androidKeyboardInset = useAndroidKeyboardBottomInset();

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flex: 1,
            width: "100%",
            maxWidth: "100%",
            paddingHorizontal: 24,
          }}
        >
          {showBack && onBack ? (
            <View
              style={{
                paddingTop: 8,
                marginBottom: 8,
                alignSelf: "flex-start",
              }}
            >
              <StackBackButton onPress={onBack} />
            </View>
          ) : (
            <View style={{ height: 16 }} />
          )}

          <ScrollView
            style={{ flex: 1, width: "100%", maxWidth: "100%", minWidth: 0 }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: 16,
              width: "100%",
            }}
            keyboardShouldPersistTaps={FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS}
            keyboardDismissMode={formScrollKeyboardDismissMode(Platform.OS)}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          <View
            style={{
              paddingBottom: 24 + androidKeyboardInset,
              paddingTop: 16,
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
            }}
          >
            {footer}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

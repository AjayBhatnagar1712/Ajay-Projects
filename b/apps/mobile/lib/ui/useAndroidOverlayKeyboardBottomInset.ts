import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { androidOverlayKeyboardInset } from "@/lib/ui/androidKeyboardInset";

/**
 * Bottom inset for transparent Modal overlays on Android.
 *
 * Always pads by keyboard height — do not reuse useAndroidKeyboardBottomInset
 * here. That hook skips padding when the Activity resized; a Dialog / overlay
 * sheet does not shrink with the Activity, so skipping leaves it covered.
 *
 * iOS returns 0 — KeyboardAvoidingView behavior="padding" handles that side.
 */
export function useAndroidOverlayKeyboardBottomInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setInset(
        androidOverlayKeyboardInset(Platform.OS, event.endCoordinates.height),
      );
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setInset(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return inset;
}

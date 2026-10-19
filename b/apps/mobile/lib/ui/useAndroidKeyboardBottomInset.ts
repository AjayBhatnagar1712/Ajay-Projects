import { useEffect, useRef, useState } from "react";
import { Dimensions, Keyboard, Platform } from "react-native";
import {
  androidKeyboardInsetFromHeight,
  androidWindowDidResizeForKeyboard,
} from "@/lib/ui/androidKeyboardInset";

/**
 * Bottom inset for pinned footers on Android.
 *
 * Pads by keyboard height only when the window did **not** resize for the
 * keyboard (Expo Go / edge-to-edge overlay). When adjustResize already shrank
 * the window, returns 0 so we do not double-count.
 *
 * iOS returns 0 — KeyboardAvoidingView behavior="padding" handles that side.
 */
export function useAndroidKeyboardBottomInset(): number {
  const [inset, setInset] = useState(0);
  const baselineWindowHeightRef = useRef(Dimensions.get("window").height);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      const keyboardHeight = event.endCoordinates.height;
      const currentWindowHeight = Dimensions.get("window").height;
      const resized = androidWindowDidResizeForKeyboard(
        baselineWindowHeightRef.current,
        currentWindowHeight,
        keyboardHeight,
      );
      setInset(
        androidKeyboardInsetFromHeight(Platform.OS, keyboardHeight, resized),
      );
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setInset(0);
      baselineWindowHeightRef.current = Dimensions.get("window").height;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return inset;
}

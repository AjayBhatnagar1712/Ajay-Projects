import { useEffect } from "react";
import { BackHandler } from "react-native";

/**
 * Android hardware / system-gesture back must use the same in-flow Back
 * handler — default stack pop would leave the create-agreement flow when
 * resume pushed a mid-flow step onto tabs.
 *
 * This does **not** cover iOS interactive pop. That gesture never fires
 * `hardwareBackPress`; it is owned by the native stack that has
 * `gestureEnabled: true`. Create-agreement is pushed over tabs, so the
 * swipe is the *root* stack dismissing the whole group (see root `_layout`
 * `(create-agreement)` options). Nested `gestureEnabled: false` alone
 * cannot stop that.
 */
export function useCreateAgreementHardwareBack(onBack: () => void): void {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
}

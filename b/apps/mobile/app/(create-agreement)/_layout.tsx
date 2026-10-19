import { Stack, useNavigation } from "expo-router";
import { useLayoutEffect } from "react";
import { CREATE_AGREEMENT_GESTURE_OPTIONS } from "@/lib/agreements/createAgreementGestureOptions";
import { peekCreateAgreementReplaceAnimation } from "@/lib/agreements/createAgreementReplaceAnimation";

/**
 * Create-agreement in-flow steps always `replace` (resume-safe — never
 * `router.back()`). Forward/back look is not a stack-wide `pop`: Next is also
 * replace, so a layout-wide `animationTypeForReplace: "pop"` would make Next
 * animate backwards.
 *
 * Direction is set synchronously in createAgreementNav before each replace;
 * screenOptions reads it when the incoming screen's options are built.
 *
 * Nested `gestureEnabled: false` is not enough on its own: the flow is pushed
 * onto the root stack over tabs, so iOS edge-swipe is the *root* interactive
 * pop (dismisses the whole group → Home). Root `_layout.tsx` also applies
 * CREATE_AGREEMENT_GESTURE_OPTIONS to the `(create-agreement)` screen; this
 * layout repeats that via setOptions so the parent screen cannot keep the
 * default iOS swipe-back.
 */
export default function CreateAgreementLayout() {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ ...CREATE_AGREEMENT_GESTURE_OPTIONS });
  }, [navigation]);

  return (
    <Stack
      screenOptions={() => ({
        headerShown: false,
        ...CREATE_AGREEMENT_GESTURE_OPTIONS,
        animation: "slide_from_right",
        animationTypeForReplace: peekCreateAgreementReplaceAnimation(),
      })}
    />
  );
}

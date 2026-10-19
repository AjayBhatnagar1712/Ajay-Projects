/**
 * Keyboard props for ScrollViews (and FlatLists) that contain text inputs.
 *
 * `on-drag` dismisses the keyboard as soon as the user scrolls, which forces
 * a re-tap into the field. `handled` persist-taps lets a tap on another
 * TextInput steal focus without the ScrollView eating the tap as a dismiss.
 *
 * Kept free of react-native so Vitest can cover the platform policy.
 */

export const FORM_SCROLL_KEYBOARD_SHOULD_PERSIST_TAPS = "handled" as const;

export type FormScrollKeyboardDismissMode = "none" | "interactive";

/**
 * iOS: `interactive` keeps the keyboard up during content scroll; the user
 * can still swipe it off-screen.
 * Android: `interactive` is inconsistent (often equivalent to `on-drag`),
 * so `none` — scroll never dismisses.
 */
export function formScrollKeyboardDismissMode(
  platformOs: string,
): FormScrollKeyboardDismissMode {
  return platformOs === "android" ? "none" : "interactive";
}

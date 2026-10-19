/**
 * Map a keyboard-show event height to footer padding.
 * Kept free of react-native so Vitest can cover Android inset policy.
 *
 * TrustKeyper sets Expo `android.softwareKeyboardLayoutMode: "resize"` for
 * custom/dev/production builds. When adjustResize actually shrinks the window,
 * the pinned footer already sits above the keyboard — padding by keyboard
 * height would double-count (large gap under CTAs on lower fields, e.g.
 * onboarding "Other").
 *
 * Expo Go and edge-to-edge Android often do **not** shrink the window (resize
 * is a no-op; app.json soft-input mode also does not apply inside Expo Go).
 * In that case the keyboard overlays the layout: footer CTAs sit behind it,
 * the ScrollView stays full-height so lower fields cannot be scrolled into the
 * visible gap, and keyboard-Next focus lands on fields that remain covered.
 *
 * Pass `windowDidResizeForKeyboard` from live Dimensions (see
 * useAndroidKeyboardBottomInset): pad only when the window did **not** resize.
 *
 * iOS is always 0 here — KeyboardAvoidingView behavior="padding" handles it.
 */
export function androidKeyboardInsetFromHeight(
  platformOs: string,
  keyboardHeight: number,
  windowDidResizeForKeyboard = false,
): number {
  if (platformOs !== "android") return 0;
  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) return 0;
  if (windowDidResizeForKeyboard) return 0;
  return keyboardHeight;
}

/**
 * True when the window height dropped enough that adjustResize (or equivalent)
 * already accounted for the keyboard — do not also pad the footer.
 */
/**
 * Keyboard inset for transparent Modal overlays (bottom sheet).
 *
 * Unlike {@link androidKeyboardInsetFromHeight}, this always pads on Android.
 * Activity `adjustResize` shrinks the *app* window, not the Dialog the sheet
 * lives in — treating that resize as "already handled" leaves the sheet
 * behind the keyboard.
 *
 * iOS is 0 — KeyboardAvoidingView behavior="padding" handles that side.
 */
export function androidOverlayKeyboardInset(
  platformOs: string,
  keyboardHeight: number,
): number {
  if (platformOs !== "android") return 0;
  if (!Number.isFinite(keyboardHeight) || keyboardHeight <= 0) return 0;
  return keyboardHeight;
}

export function androidWindowDidResizeForKeyboard(
  baselineWindowHeight: number,
  currentWindowHeight: number,
  keyboardHeight: number,
): boolean {
  if (
    !Number.isFinite(baselineWindowHeight) ||
    !Number.isFinite(currentWindowHeight) ||
    !Number.isFinite(keyboardHeight) ||
    keyboardHeight <= 0
  ) {
    return false;
  }
  const shrunkBy = baselineWindowHeight - currentWindowHeight;
  // Half the reported keyboard height: full shrink ≈ keyboard; overlay ≈ 0.
  return shrunkBy >= keyboardHeight * 0.5;
}

import type { RefObject } from "react";
import type { ReturnKeyTypeOptions } from "react-native";

/** Minimal handle exposed by form field wrappers for keyboard Next chaining. */
export type FieldFocusHandle = {
  focus: () => void;
  /** Window coordinates — used on Android to scroll covered fields into view. */
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export type FieldKeyboardProps = {
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
};

/** Focus the next field in a keyboard chain. */
export function focusNextField(
  nextRef: RefObject<FieldFocusHandle | null>,
): () => void {
  return () => {
    nextRef.current?.focus();
    try {
      // Lazy require keeps this module loadable under Vitest (node).
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- RN at call time
      const { Platform } = require("react-native") as {
        Platform: { OS: string };
      };
      if (Platform.OS !== "android") return;
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- registry at call time
      const { scheduleScrollFieldIntoView } =
        require("./formScrollRegistry") as {
          scheduleScrollFieldIntoView: (
            ref: RefObject<FieldFocusHandle | null>,
          ) => void;
        };
      scheduleScrollFieldIntoView(nextRef);
    } catch {
      // Node/Vitest without a react-native Platform mock — focus-only is enough.
    }
  };
}

/**
 * Core last-field submit: dismiss then run primary CTA.
 * Kept free of react-native imports so Vitest can cover it in node.
 */
export function runPrimaryAfterDismiss(
  action: () => void,
  dismissKeyboard: () => void,
): void {
  dismissKeyboard();
  action();
}

/**
 * Last-field keyboard action: dismiss the keyboard, then run the same primary
 * CTA as the footer button. Invalid forms rely on that CTA (e.g. RHF
 * `handleSubmit`) to surface validation errors.
 */
export function submitPrimaryFromKeyboard(action: () => void): () => void {
  return () => {
    // Lazy require keeps this module loadable under Vitest (node) when tests
    // only exercise `focusNextField` / `runPrimaryAfterDismiss`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- RN at call time
    const { Keyboard } = require("react-native") as {
      Keyboard: { dismiss: () => void };
    };
    runPrimaryAfterDismiss(action, () => Keyboard.dismiss());
  };
}

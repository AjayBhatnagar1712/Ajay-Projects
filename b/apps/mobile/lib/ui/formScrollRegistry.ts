import type { RefObject } from "react";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";

export type FormScrollController = {
  scrollFieldIntoView: (field: FieldFocusHandle) => void;
};

let activeFormScroll: FormScrollController | null = null;

/** CreationStepLayout registers while mounted so keyboard-Next can scroll. */
export function registerFormScroll(
  controller: FormScrollController | null,
): void {
  activeFormScroll = controller;
}

/**
 * After programmatic focus, Android often leaves the field behind the keyboard.
 * Defer until focus + footer inset layout settle, then scroll if needed.
 */
export function scheduleScrollFieldIntoView(
  nextRef: RefObject<FieldFocusHandle | null>,
): void {
  setTimeout(() => {
    const field = nextRef.current;
    if (!field || !activeFormScroll) return;
    activeFormScroll.scrollFieldIntoView(field);
  }, 64);
}

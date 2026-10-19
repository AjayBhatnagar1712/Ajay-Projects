/**
 * Primary-tinted secondary CTAs (e.g. Inventory "Add item", parties "Add another…")
 * must drop custom text/outline colors when disabled so Paper's muted disabled
 * state applies to label, icon, and border — same as plain secondary buttons.
 */
export function resolveSecondaryAccent(options: {
  isDisabled: boolean;
  isLoading?: boolean;
  textColor?: string;
  outlineColor?: string;
}): {
  textColor: string | undefined;
  outlineStyle: { borderColor: string } | null;
} {
  if (options.isDisabled || options.isLoading) {
    return { textColor: undefined, outlineStyle: null };
  }
  return {
    textColor: options.textColor,
    outlineStyle: options.outlineColor
      ? { borderColor: options.outlineColor }
      : null,
  };
}

/**
 * Whether a party form section should show its fields.
 *
 * Universal: errored parties stay expanded (never hide validation behind a
 * collapsed accordion), regardless of party count or expandedIds.
 * Single-party rows have no accordion chrome — always show fields.
 * Otherwise honour the expandedIds set.
 */
export function isPartyFormExpanded(options: {
  roleCount: number;
  hasErrors: boolean;
  isInExpandedSet: boolean;
}): boolean {
  if (options.hasErrors) return true;
  if (options.roleCount < 2) return true;
  return options.isInExpandedSet;
}

/** Accordion: only one party id expanded at a time. Tapping the open card collapses it. */
export function nextExclusiveExpandedIds(
  current: ReadonlySet<string>,
  fieldId: string,
): Set<string> {
  if (current.has(fieldId)) return new Set();
  return new Set([fieldId]);
}

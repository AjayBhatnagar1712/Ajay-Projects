/**
 * Turn a preview-blocked 400 into short bullet lines for the UI.
 * Prefers the API `missing` array when present; otherwise splits the error string.
 */
export function previewBlockedBulletItems(
  message: string,
  missing: unknown,
): string[] {
  const fromMissing = Array.isArray(missing)
    ? missing.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      )
    : [];

  const rawItems =
    fromMissing.length > 0 ? fromMissing : splitPreviewBlockedMessage(message);

  const bullets = rawItems.flatMap(expandOwnerTenantRequirement);
  if (bullets.length === 0) {
    const trimmed = message.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }
  return bullets;
}

function splitPreviewBlockedMessage(message: string): string[] {
  const stripped = message
    .replace(/^Lease agreement draft is incomplete\.\s*/i, "")
    .trim();
  if (!stripped) return [];
  return stripped
    .split(/\.\s+/)
    .map((part) => part.replace(/\.$/, "").trim())
    .filter((part) => part.length > 0);
}

/** Combined owner+tenant validation → two scannable bullets. */
function expandOwnerTenantRequirement(item: string): string[] {
  if (/at least one owner and one tenant/i.test(item)) {
    return ["At least one owner", "At least one tenant"];
  }
  return [item.replace(/\.$/, "").trim()].filter((part) => part.length > 0);
}

/**
 * RHF + Zod may store field-array errors as a real array OR as an object with
 * numeric keys (plus optional `message` / `root`). The earlier auto-expand bug
 * treated non-arrays as "no errors" and silently skipped expansion.
 */
export type PartyFieldErrorsLike =
  | ReadonlyArray<unknown>
  | Record<string, unknown>
  | null
  | undefined;

const UNIQUE_PHONE_MESSAGE = "Party phone numbers must be unique";

function entryAt(partyErrors: PartyFieldErrorsLike, index: number): unknown {
  if (partyErrors == null) return undefined;
  if (Array.isArray(partyErrors)) {
    return partyErrors[index];
  }
  const bag = partyErrors as Record<string, unknown>;
  return bag[String(index)];
}

function isFieldErrorEntry(entry: unknown): boolean {
  if (entry == null || typeof entry !== "object") return false;
  // Root-only bags live on the array object itself (`message` / `root`), not at indexes.
  return true;
}

function messageFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value == null || typeof value !== "object") return null;
  const bag = value as Record<string, unknown>;
  if (typeof bag.message === "string" && bag.message.length > 0) {
    return bag.message;
  }
  return null;
}

/** Root-level parties error (e.g. unique phones) — not a per-party field bag. */
export function rootPartyErrorMessage(
  partyErrors: PartyFieldErrorsLike,
): string | null {
  if (partyErrors == null || typeof partyErrors !== "object") return null;
  if (Array.isArray(partyErrors)) {
    // Rare: array with message property still possible on RHF FieldError[].
    return messageFromUnknown(
      (partyErrors as unknown as { message?: unknown }).message,
    );
  }
  const bag = partyErrors as Record<string, unknown>;
  return (
    messageFromUnknown(bag.message) ??
    messageFromUnknown(bag.root) ??
    null
  );
}

export function isUniquePhonePartyError(
  partyErrors: PartyFieldErrorsLike,
): boolean {
  return rootPartyErrorMessage(partyErrors) === UNIQUE_PHONE_MESSAGE;
}

/**
 * Indexes whose phone appears more than once (trimmed). Empty phones are
 * compared as-is so two blank phones still collide under the unique rule.
 */
export function indexesWithDuplicatePhones(
  phones: readonly (string | null | undefined)[],
): number[] {
  const normalized = phones.map((phone) => (phone ?? "").trim());
  const counts = new Map<string, number>();
  for (const phone of normalized) {
    counts.set(phone, (counts.get(phone) ?? 0) + 1);
  }
  const indexes: number[] = [];
  normalized.forEach((phone, index) => {
    if ((counts.get(phone) ?? 0) > 1) indexes.push(index);
  });
  return indexes;
}

/** Indexes of parties that have at least one field-level error. */
export function partyIndexesWithFieldErrors(
  partyErrors: PartyFieldErrorsLike,
  partyCount: number,
): number[] {
  if (partyErrors == null || partyCount <= 0) return [];
  const indexes: number[] = [];
  for (let index = 0; index < partyCount; index += 1) {
    if (isFieldErrorEntry(entryAt(partyErrors, index))) {
      indexes.push(index);
    }
  }
  return indexes;
}

export function partyHasFieldErrors(
  partyErrors: PartyFieldErrorsLike,
  index: number,
): boolean {
  return isFieldErrorEntry(entryAt(partyErrors, index));
}

/** Field-array ids that must expand after a failed submit (field-level only). */
export function fieldIdsToExpandForPartyErrors(
  fieldIds: readonly string[],
  partyErrors: PartyFieldErrorsLike,
): string[] {
  return partyIndexesWithFieldErrors(partyErrors, fieldIds.length)
    .map((index) => fieldIds[index])
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Expand targets after invalid submit: prefer field-level errors; for the
 * unique-phone root rule, expand every party that shares a duplicate phone.
 */
export function fieldIdsToExpandForInvalidParties(
  fieldIds: readonly string[],
  partyErrors: PartyFieldErrorsLike,
  phones: readonly (string | null | undefined)[],
): string[] {
  const fromFields = fieldIdsToExpandForPartyErrors(fieldIds, partyErrors);
  if (fromFields.length > 0) return fromFields;

  if (!isUniquePhonePartyError(partyErrors)) return [];

  return indexesWithDuplicatePhones(phones)
    .map((index) => fieldIds[index])
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export { UNIQUE_PHONE_MESSAGE };

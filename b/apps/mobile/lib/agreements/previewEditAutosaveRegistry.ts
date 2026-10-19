type FlushFn = () => Promise<void>;

const flushesByAgreement = new Map<string, Map<string, FlushFn>>();
const discardingIds = new Set<string>();

/**
 * Preview → Edit draft: each step's autosave hook registers here so Cancel
 * Save/Discard can flush Property PATCH, parties PUT, and inventory PUT —
 * not only the currently mounted step.
 */
export function registerPreviewEditAutosave(
  agreementId: string,
  stepKey: string,
  flush: FlushFn,
): () => void {
  let byStep = flushesByAgreement.get(agreementId);
  if (!byStep) {
    byStep = new Map();
    flushesByAgreement.set(agreementId, byStep);
  }
  byStep.set(stepKey, flush);
  return () => {
    const current = flushesByAgreement.get(agreementId);
    if (!current) return;
    if (current.get(stepKey) === flush) {
      current.delete(stepKey);
    }
    if (current.size === 0) {
      flushesByAgreement.delete(agreementId);
    }
  };
}

export async function flushPreviewEditAutosaves(
  agreementId: string,
): Promise<void> {
  const byStep = flushesByAgreement.get(agreementId);
  if (!byStep) return;
  const pending = [...byStep.values()].map((flush) => flush());
  await Promise.all(pending);
}

export function markPreviewEditDiscarding(agreementId: string): void {
  discardingIds.add(agreementId);
}

export function isPreviewEditDiscarding(agreementId: string): boolean {
  return discardingIds.has(agreementId);
}

export function endPreviewEditAutosaveSession(agreementId: string): void {
  flushesByAgreement.delete(agreementId);
  discardingIds.delete(agreementId);
}

/** Test helper — do not use in product code. */
export function clearPreviewEditAutosaveRegistry(): void {
  flushesByAgreement.clear();
  discardingIds.clear();
}

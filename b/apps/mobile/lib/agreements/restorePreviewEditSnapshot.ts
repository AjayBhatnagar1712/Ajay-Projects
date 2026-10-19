import type { QueryClient } from "@tanstack/react-query";
import {
  patchLeaseAgreement,
  replaceLeaseAgreementInventory,
  replaceLeaseAgreementParties,
} from "../api/client";
import {
  inventoryReplaceFromDetail,
  partiesReplaceFromDetail,
  peekPreviewEditSnapshot,
  scalarPatchFromDetail,
} from "./previewEditSession";

/**
 * Write the captured pre-edit detail back to the server. Autosave may already
 * have PATCHed/PUTed in-session edits; this overwrites them with the snapshot.
 */
export async function restorePreviewEditSnapshot(
  agreementId: string,
  queryClient: QueryClient,
): Promise<void> {
  const snapshot = peekPreviewEditSnapshot(agreementId);
  if (!snapshot) return;

  await patchLeaseAgreement(agreementId, scalarPatchFromDetail(snapshot));
  const parties = partiesReplaceFromDetail(snapshot);
  if (parties) {
    await replaceLeaseAgreementParties(agreementId, parties);
  }
  await replaceLeaseAgreementInventory(
    agreementId,
    inventoryReplaceFromDetail(snapshot),
  );
  queryClient.setQueryData(["lease-agreement", agreementId], snapshot);
  await queryClient.invalidateQueries({
    queryKey: ["lease-agreement", agreementId],
  });
  await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
  await queryClient.invalidateQueries({
    queryKey: ["lease-agreement-preview", agreementId],
  });
}

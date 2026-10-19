import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert as NativeAlert } from "react-native";
import {
  type CreateAgreementEditOrigin,
  type CreateAgreementEntry,
  isSnapshotEditOrigin,
  returnToCreateAgreementEditOrigin,
} from "@/lib/agreements/createAgreementNav";
import { clearCreateAgreementStepReplaceAnimation } from "@/lib/agreements/createAgreementReplaceAnimation";
import {
  flushPreviewEditAutosaves,
  markPreviewEditDiscarding,
} from "@/lib/agreements/previewEditAutosaveRegistry";
import { restorePreviewEditSnapshot } from "@/lib/agreements/restorePreviewEditSnapshot";
import { ApiError, deleteLeaseAgreement } from "@/lib/api/client";

type Options = {
  agreementId: string | undefined;
  entry: CreateAgreementEntry;
  editOrigin?: CreateAgreementEditOrigin;
  flushAutosave?: () => Promise<void>;
};

/**
 * Create-agreement Cancel.
 *
 * Standard entry (Home / Agreements / resume): confirm, DELETE the draft,
 * then Agreements tab.
 *
 * Preview or Review-screen → Edit draft: never deletes. Save flushes every
 * registered step autosave then returns to that origin; Discard restores
 * the pre-edit snapshot then returns. Same snapshot mechanism; destination
 * depends on `editOrigin`.
 */
export function useCancelAgreementDraft({
  agreementId,
  entry,
  editOrigin,
  flushAutosave,
}: Options) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isCancelling, setIsCancelling] = useState(false);

  async function confirmDeleteDraft(): Promise<void> {
    setIsCancelling(true);
    try {
      if (agreementId) {
        await deleteLeaseAgreement(agreementId);
        await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
        queryClient.removeQueries({
          queryKey: ["lease-agreement", agreementId],
        });
      }
      clearCreateAgreementStepReplaceAnimation();
      router.replace("/(tabs)/agreements");
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not cancel this agreement. Try again.";
      NativeAlert.alert("Couldn't cancel", message);
    } finally {
      setIsCancelling(false);
    }
  }

  async function saveSnapshotEdits(): Promise<void> {
    if (!agreementId || !isSnapshotEditOrigin(editOrigin)) return;
    setIsCancelling(true);
    try {
      await flushAutosave?.();
      await flushPreviewEditAutosaves(agreementId);
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement-preview", agreementId],
      });
      returnToCreateAgreementEditOrigin(router, agreementId, entry, editOrigin);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not save changes. Try again.";
      NativeAlert.alert("Couldn't save", message);
    } finally {
      setIsCancelling(false);
    }
  }

  async function discardSnapshotEdits(): Promise<void> {
    if (!agreementId || !isSnapshotEditOrigin(editOrigin)) return;
    setIsCancelling(true);
    try {
      markPreviewEditDiscarding(agreementId);
      // Settle every step's in-flight/pending autosave first so a late
      // PATCH/PUT cannot overwrite the snapshot restore.
      try {
        await flushAutosave?.();
        await flushPreviewEditAutosaves(agreementId);
      } catch {
        // Restore still wins; ignore a failed flush.
      }
      await restorePreviewEditSnapshot(agreementId, queryClient);
      returnToCreateAgreementEditOrigin(router, agreementId, entry, editOrigin);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not discard changes. Try again.";
      NativeAlert.alert("Couldn't discard", message);
    } finally {
      setIsCancelling(false);
    }
  }

  function requestCancel(): void {
    if (isSnapshotEditOrigin(editOrigin)) {
      NativeAlert.alert(
        "Save your changes?",
        "Save keeps what you edited on this draft. Discard restores it to how it looked before you tapped Edit draft.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Save changes",
            onPress: () => {
              void saveSnapshotEdits();
            },
          },
          {
            text: "Discard changes",
            style: "destructive",
            onPress: () => {
              void discardSnapshotEdits();
            },
          },
        ],
      );
      return;
    }

    NativeAlert.alert(
      "Cancel this agreement?",
      "This can't be undone — all entered details will be deleted.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Cancel agreement",
          style: "destructive",
          onPress: () => {
            void confirmDeleteDraft();
          },
        },
      ],
    );
  }

  return { requestCancel, isCancelling };
}

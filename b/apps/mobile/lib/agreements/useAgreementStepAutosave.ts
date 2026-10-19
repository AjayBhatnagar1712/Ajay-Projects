import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "@/lib/hooks/useDebouncedCallback";
import {
  isPreviewEditDiscarding,
  registerPreviewEditAutosave,
} from "./previewEditAutosaveRegistry";
import { serializeAutosavePayload } from "./stepAutosavePayloads";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const DEFAULT_DELAY_MS = 1200;
/** How long "Saved" stays visible before returning to idle. */
const SAVED_VISIBLE_MS = 2000;

type Options<TPayload> = {
  /** Form snapshot — any change reschedules autosave. */
  watched: unknown;
  /** Build API payload; return null to skip (not yet saveable). */
  buildPayload: () => TPayload | null;
  save: (payload: TPayload) => Promise<void>;
  enabled?: boolean;
  delayMs?: number;
  /**
   * Serialized payload already on the server (from detail). Prevents an
   * immediate save-on-mount and anchors the dirty check for in-review resets.
   */
  initialSerialized?: string | null;
  /**
   * Preview → Edit draft: register this step's flush so Cancel Save can
   * persist parties/inventory/scalars after the broker has left the step.
   */
  previewEditAgreementId?: string;
  previewEditStepKey?: string;
};

/**
 * Debounced step autosave with dirty-check against the last successful save.
 * Identical payloads after debounce do not hit the network — critical so
 * in_review approval resets only fire when values actually change.
 */
export function useAgreementStepAutosave<TPayload>({
  watched,
  buildPayload,
  save,
  enabled = true,
  delayMs = DEFAULT_DELAY_MS,
  initialSerialized = null,
  previewEditAgreementId,
  previewEditStepKey,
}: Options<TPayload>): {
  status: AutosaveStatus;
  flush: () => Promise<void>;
  cancel: () => void;
  /** Call after an explicit Next/Finish save so dirty state stays aligned. */
  markSaved: (payload: TPayload) => void;
} {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const lastSavedRef = useRef<string | null>(initialSerialized);
  const savedHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buildPayloadRef = useRef(buildPayload);
  const saveRef = useRef(save);
  const enabledRef = useRef(enabled);

  useEffect(() => {
    buildPayloadRef.current = buildPayload;
    saveRef.current = save;
    enabledRef.current = enabled;
  }, [buildPayload, save, enabled]);

  useEffect(() => {
    lastSavedRef.current = initialSerialized;
  }, [initialSerialized]);

  useEffect(() => {
    return () => {
      if (savedHideTimerRef.current !== null) {
        clearTimeout(savedHideTimerRef.current);
      }
    };
  }, []);

  const markSaved = useCallback((payload: TPayload) => {
    lastSavedRef.current = serializeAutosavePayload(payload);
    setStatus("saved");
    if (savedHideTimerRef.current !== null) {
      clearTimeout(savedHideTimerRef.current);
    }
    savedHideTimerRef.current = setTimeout(() => {
      setStatus((current) => (current === "saved" ? "idle" : current));
      savedHideTimerRef.current = null;
    }, SAVED_VISIBLE_MS);
  }, []);

  const runSave = useCallback(async () => {
    if (!enabledRef.current) return;
    const payload = buildPayloadRef.current();
    if (payload === null) return;
    const serialized = serializeAutosavePayload(payload);
    if (serialized === lastSavedRef.current) return;

    setStatus("saving");
    try {
      await saveRef.current(payload);
      lastSavedRef.current = serialized;
      setStatus("saved");
      if (savedHideTimerRef.current !== null) {
        clearTimeout(savedHideTimerRef.current);
      }
      savedHideTimerRef.current = setTimeout(() => {
        setStatus((current) => (current === "saved" ? "idle" : current));
        savedHideTimerRef.current = null;
      }, SAVED_VISIBLE_MS);
    } catch {
      setStatus("error");
    }
  }, []);

  const { schedule, cancel, flush } = useDebouncedCallback(runSave, delayMs);

  useEffect(() => {
    if (!enabled) return;
    schedule();
  }, [watched, enabled, schedule]);

  useEffect(() => {
    if (!previewEditAgreementId || !previewEditStepKey) return;
    const agreementId = previewEditAgreementId;
    const unregister = registerPreviewEditAutosave(
      agreementId,
      previewEditStepKey,
      flush,
    );
    return () => {
      if (isPreviewEditDiscarding(agreementId)) {
        unregister();
        return;
      }
      void flush().finally(unregister);
    };
  }, [flush, previewEditAgreementId, previewEditStepKey]);

  return { status, flush, cancel, markSaved };
}

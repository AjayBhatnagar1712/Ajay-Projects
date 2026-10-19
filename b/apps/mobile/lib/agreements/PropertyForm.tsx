import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  createLeaseAgreement,
  patchLeaseAgreement,
  type LeaseAgreementDetail,
} from "../api/client";
import {
  type CreateAgreementEditOrigin,
  type CreateAgreementEntry,
  exitCreateAgreementToEntry,
  isSnapshotEditOrigin,
  replaceCreateAgreementStep,
  returnToCreateAgreementEditOrigin,
} from "./createAgreementNav";
import {
  PropertyStepSchema,
  PROPERTY_FACING_OPTIONS,
  type PropertyStepValues,
} from "./flow";
import {
  buildPropertyAutosavePatch,
  serializeAutosavePayload,
} from "./stepAutosavePayloads";
import { useAgreementStepAutosave } from "./useAgreementStepAutosave";
import { useCreateAgreementHardwareBack } from "./useCreateAgreementHardwareBack";
import { shape } from "@/lib/theme/shape";
import { Alert } from "@/lib/ui/Alert";
import { CreateAgreementStepLayout } from "@/lib/ui/CreateAgreementStepLayout";
import { TintedSectionCard } from "@/lib/ui/TintedSectionCard";
import {
  focusNextField,
  submitPrimaryFromKeyboard,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { SelectField } from "@/lib/ui/SelectField";
import { TextAreaField } from "@/lib/ui/TextAreaField";
import { TextField } from "@/lib/ui/TextField";

type PropertyFormProps = {
  agreementId?: string;
  detail?: LeaseAgreementDetail;
  entry: CreateAgreementEntry;
  editOrigin?: CreateAgreementEditOrigin;
};

export function PropertyForm({
  agreementId,
  detail,
  entry,
  editOrigin,
}: PropertyFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draftId, setDraftId] = useState<string | undefined>(agreementId);
  const draftIdRef = useRef(draftId);
  draftIdRef.current = draftId;
  const createLockRef = useRef<Promise<string> | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addressRef = useRef<FieldFocusHandle>(null);
  const areaRef = useRef<FieldFocusHandle>(null);
  const parkingRef = useRef<FieldFocusHandle>(null);
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<PropertyStepValues>({
    resolver: zodResolver(PropertyStepSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      propertyAddress: detail?.propertyAddress ?? "",
      areaSqft:
        detail?.areaSqft === null || detail?.areaSqft === undefined
          ? ""
          : String(detail.areaSqft),
      facing: detail?.facing ?? "",
      carParkingCount:
        detail?.carParkingCount === null || detail?.carParkingCount === undefined
          ? ""
          : String(detail.carParkingCount),
    },
  });

  const watched = useWatch({ control });

  const [initialSerialized] = useState(() => {
    if (!detail) return null;
    const patch = buildPropertyAutosavePatch({
      propertyAddress: detail.propertyAddress ?? "",
      areaSqft:
        detail.areaSqft === null || detail.areaSqft === undefined
          ? ""
          : String(detail.areaSqft),
      facing: detail.facing ?? "",
      carParkingCount:
        detail.carParkingCount === null || detail.carParkingCount === undefined
          ? ""
          : String(detail.carParkingCount),
    });
    return patch ? serializeAutosavePayload(patch) : null;
  });

  const ensureDraftId = useCallback(async (): Promise<string> => {
    const existing = draftIdRef.current;
    if (existing) return existing;
    if (createLockRef.current) return createLockRef.current;
    createLockRef.current = createLeaseAgreement()
      .then((created) => {
        draftIdRef.current = created.id;
        setDraftId(created.id);
        return created.id;
      })
      .finally(() => {
        createLockRef.current = null;
      });
    return createLockRef.current;
  }, []);

  const buildPayload = useCallback(
    () => buildPropertyAutosavePatch(getValues()),
    [getValues],
  );

  const savePatch = useCallback(
    async (patch: NonNullable<ReturnType<typeof buildPropertyAutosavePatch>>) => {
      const id = await ensureDraftId();
      await patchLeaseAgreement(id, patch);
      await queryClient.invalidateQueries({ queryKey: ["lease-agreement", id] });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
    },
    [ensureDraftId, queryClient],
  );

  const {
    status: autosaveStatus,
    flush: flushAutosave,
    cancel: cancelAutosave,
    markSaved,
  } = useAgreementStepAutosave({
    watched,
    buildPayload,
    save: savePatch,
    initialSerialized,
    previewEditAgreementId: isSnapshotEditOrigin(editOrigin)
      ? (draftId ?? agreementId)
      : undefined,
    previewEditStepKey: "property",
  });

  const onNext = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      // Flush any pending debounce first; Next still saves validated values
      // authoritatively so incomplete autosave never blocks advance.
      await flushAutosave();
      const id = await ensureDraftId();
      const patch = {
        propertyAddress: values.propertyAddress,
        areaSqft: Number(values.areaSqft),
        facing: values.facing,
        carParkingCount: Number(values.carParkingCount),
      };
      await patchLeaseAgreement(id, patch);
      markSaved(patch);
      await queryClient.invalidateQueries({ queryKey: ["lease-agreement", id] });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      replaceCreateAgreementStep(router, 2, entry, id, editOrigin);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Could not save property",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const onBack = useCallback(() => {
    void (async () => {
      await flushAutosave();
      if (isSnapshotEditOrigin(editOrigin) && draftIdRef.current) {
        returnToCreateAgreementEditOrigin(
          router,
          draftIdRef.current,
          entry,
          editOrigin,
        );
        return;
      }
      exitCreateAgreementToEntry(router, entry);
    })();
  }, [editOrigin, entry, flushAutosave, router]);

  useCreateAgreementHardwareBack(onBack);

  return (
    <CreateAgreementStepLayout
      step={1}
      title="Property Details"
      agreementId={draftId}
      entry={entry}
      editOrigin={editOrigin}
      onBack={onBack}
      onNext={() => void onNext()}
      isSubmitting={isSubmitting}
      autosaveStatus={autosaveStatus}
      onBeforeCancel={cancelAutosave}
      flushAutosave={flushAutosave}
    >
      <TintedSectionCard gap={shape.sectionFieldGap}>
        {/*
          Property nickname is intentionally omitted: lease_agreements has no
          nickname column / PATCH field yet. Flagged in the redesign report —
          do not invent a silent no-op field.
        */}
        <Controller
          control={control}
          name="propertyAddress"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextAreaField
              ref={addressRef}
              label="Property Address"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              isDisabled={isSubmitting}
              error={errors.propertyAddress?.message}
              returnKeyType="next"
              blurOnSubmit
              onSubmitEditing={focusNextField(areaRef)}
            />
          )}
        />

        <Controller
          control={control}
          name="areaSqft"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              ref={areaRef}
              label="Area (sq ft)"
              value={value}
              onBlur={onBlur}
              onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
              isDisabled={isSubmitting}
              keyboardType="number"
              error={errors.areaSqft?.message}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={focusNextField(parkingRef)}
            />
          )}
        />

        <Controller
          control={control}
          name="facing"
          render={({ field: { onBlur, onChange, value } }) => (
            <SelectField
              label="Facing"
              value={value}
              options={PROPERTY_FACING_OPTIONS}
              onChange={onChange}
              onBlur={onBlur}
              isDisabled={isSubmitting}
              error={errors.facing?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="carParkingCount"
          render={({ field: { onBlur, onChange, value } }) => (
            <TextField
              ref={parkingRef}
              label="Car parking"
              value={value}
              onBlur={onBlur}
              onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
              isDisabled={isSubmitting}
              keyboardType="number"
              error={errors.carParkingCount?.message}
              returnKeyType="next"
              onSubmitEditing={submitPrimaryFromKeyboard(() => void onNext())}
            />
          )}
        />
      </TintedSectionCard>

      {submitError ? <Alert description={submitError} /> : null}
    </CreateAgreementStepLayout>
  );
}

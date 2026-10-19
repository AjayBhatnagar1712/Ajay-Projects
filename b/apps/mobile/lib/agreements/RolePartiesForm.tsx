import { zodResolver } from "@hookform/resolvers/zod";
import type { LeasePartiesReplace, LeasePartyRole } from "@workspace/api-schemas";
import { partyPhoneUniqueKey } from "@workspace/api-schemas";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import {
  Alert as NativeAlert,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Icon, Text } from "react-native-paper";
import {
  replaceLeaseAgreementParties,
  type LeaseAgreementDetail,
} from "../api/client";
import {
  type CreateAgreementEditOrigin,
  type CreateAgreementEntry,
  type CreateAgreementStep,
  goToPreviousCreateStep,
  replaceCreateAgreementStep,
} from "./createAgreementNav";
import {
  createRolePartySchema,
  defaultNewRoleParties,
  emptyParty,
  primaryByRole,
} from "./flow";
import {
  isPartyFullyComplete,
  partyCardLabel,
  partyHasEnteredData,
} from "./partyCardHelpers";
import {
  fieldIdsToExpandForInvalidParties,
  indexesWithDuplicatePhones,
  isUniquePhonePartyError,
  partyHasFieldErrors,
  rootPartyErrorMessage,
  UNIQUE_PHONE_MESSAGE,
} from "./partyFormErrors";
import {
  detailPartiesAsInput,
  maxPartiesForRole,
  mergeRolePartiesForSave,
} from "./rolePartyMerge";
import { isPartyFormExpanded, nextExclusiveExpandedIds } from "./partyExpandState";
import {
  buildPartiesAutosavePayload,
  serializeAutosavePayload,
} from "./stepAutosavePayloads";
import { useAgreementStepAutosave } from "./useAgreementStepAutosave";
import { useCreateAgreementHardwareBack } from "./useCreateAgreementHardwareBack";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { CreateAgreementStepLayout } from "@/lib/ui/CreateAgreementStepLayout";
import { TintedSectionCard } from "@/lib/ui/TintedSectionCard";
import { submitPrimaryFromKeyboard } from "@/lib/ui/fieldFocusChain";
import { PartyExpandedTextFields } from "./PartyExpandedTextFields";

type RolePartiesFormProps = {
  role: LeasePartyRole;
  agreementId: string;
  detail: LeaseAgreementDetail;
  entry: CreateAgreementEntry;
  editOrigin?: CreateAgreementEditOrigin;
  step: 2 | 3;
  title: string;
  addButtonTitle: string;
  nextStep: CreateAgreementStep;
};

export function RolePartiesForm({
  role,
  agreementId,
  detail,
  entry,
  editOrigin,
  step,
  title,
  addButtonTitle,
  nextStep,
}: RolePartiesFormProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [footerValidationError, setFooterValidationError] = useState<
    string | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [didInitExpand, setDidInitExpand] = useState(false);
  const pendingExpandRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const allSaved = useMemo(
    () => detailPartiesAsInput(detail.parties),
    [detail.parties],
  );
  const oppositeRole: LeasePartyRole = role === "owner" ? "tenant" : "owner";
  const oppositeSaved = useMemo(
    () => allSaved.filter((party) => party.role === oppositeRole),
    [allSaved, oppositeRole],
  );
  const savedRoleParties = useMemo(
    () => allSaved.filter((party) => party.role === role),
    [allSaved, role],
  );
  const defaultParties =
    savedRoleParties.length > 0
      ? primaryByRole(savedRoleParties)
      : defaultNewRoleParties(role);

  const roleSchema = useMemo(() => createRolePartySchema(role), [role]);

  const {
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LeasePartiesReplace>({
    // Keep default onSubmit — blank-on-blur is per-field via PartyExpandedTextFields
    // helpers so one blur does not light up every empty required sibling.
    resolver: zodResolver(roleSchema),
    defaultValues: { parties: defaultParties },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "parties" });
  const parties = watch("parties");

  const maxForRole = maxPartiesForRole(oppositeSaved.length);

  const [initialSerialized] = useState(() => {
    if (savedRoleParties.length === 0 && oppositeSaved.length === 0) return null;
    const merged = mergeRolePartiesForSave(role, savedRoleParties, oppositeSaved);
    const payload = buildPartiesAutosavePayload(merged);
    return payload ? serializeAutosavePayload(payload) : null;
  });

  const buildPayload = useCallback(() => {
    const merged = mergeRolePartiesForSave(
      role,
      getValues("parties"),
      oppositeSaved,
    );
    return buildPartiesAutosavePayload(merged);
  }, [getValues, oppositeSaved, role]);

  const savePartiesAutosave = useCallback(
    async (payload: NonNullable<ReturnType<typeof buildPartiesAutosavePayload>>) => {
      await replaceLeaseAgreementParties(agreementId, payload);
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
    },
    [agreementId, queryClient],
  );

  const {
    status: autosaveStatus,
    flush: flushAutosave,
    cancel: cancelAutosave,
    markSaved,
  } = useAgreementStepAutosave({
    watched: parties,
    buildPayload,
    save: savePartiesAutosave,
    initialSerialized,
    previewEditAgreementId: editOrigin ? agreementId : undefined,
    previewEditStepKey: role === "owner" ? "owners" : "tenants",
  });

  useEffect(() => {
    if (didInitExpand || fields.length === 0) return;
    const initial = new Set<string>();
    fields.forEach((field, index) => {
      const name = getValues(`parties.${index}.name`)?.trim() ?? "";
      if (name.length === 0) initial.add(field.id);
    });
    setExpandedIds(initial);
    setDidInitExpand(true);
  }, [didInitExpand, fields, getValues]);

  // Expand only the newly appended party; collapse previous ones.
  useEffect(() => {
    if (!pendingExpandRef.current) return;
    const last = fields[fields.length - 1];
    if (!last) return;
    pendingExpandRef.current = false;
    setExpandedIds(new Set([last.id]));
  }, [fields]);

  function toggleExpanded(fieldId: string): void {
    setExpandedIds((prev) => nextExclusiveExpandedIds(prev, fieldId));
  }

  /**
   * Stamp primaries in local form state without replacing the field-array
   * identity. Replacing the whole `parties` array (old syncPrimaries) remounts
   * useFieldArray rows and orphans expandedIds — that caused errored cards to
   * stay collapsed after Next even when expand-on-error ran.
   */
  function stampPrimariesInPlace(): void {
    const current = getValues("parties");
    const stamped = primaryByRole(current);
    stamped.forEach((party, index) => {
      if (current[index]?.isPrimary !== party.isPrimary) {
        setValue(`parties.${index}.isPrimary`, party.isPrimary, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
      if (current[index]?.sortOrder !== party.sortOrder) {
        setValue(`parties.${index}.sortOrder`, party.sortOrder, {
          shouldDirty: true,
          shouldValidate: false,
        });
      }
    });
  }

  const lastPartyComplete =
    parties.length === 0
      ? false
      : isPartyFullyComplete(parties[parties.length - 1] ?? emptyParty(role, true));

  const canAddParty =
    !isSubmitting &&
    parties.length < maxForRole &&
    lastPartyComplete;

  function addParty(): void {
    if (!canAddParty) return;
    const current = getValues("parties");
    if (current.length >= maxForRole) return;
    const isPrimary = current.length === 0;
    pendingExpandRef.current = true;
    append(emptyParty(role, isPrimary));
    stampPrimariesInPlace();
  }

  function confirmRemoveParty(index: number): void {
    const party = getValues("parties")[index];
    if (!party) return;
    const fieldId = fields[index]?.id;
    const doRemove = () => {
      remove(index);
      stampPrimariesInPlace();
      if (fieldId) {
        setExpandedIds((prev) => {
          const updated = new Set(prev);
          updated.delete(fieldId);
          return updated;
        });
      }
    };

    if (!partyHasEnteredData(party)) {
      doRemove();
      return;
    }

    NativeAlert.alert(
      "Remove this party?",
      "Their details will be discarded from this draft.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: doRemove },
      ],
    );
  }

  const saveParties = handleSubmit(
    async (values) => {
      const merged = mergeRolePartiesForSave(
        role,
        primaryByRole(values.parties),
        oppositeSaved,
      );
      const phoneKeys = merged.map((party) => partyPhoneUniqueKey(party.phone));
      if (new Set(phoneKeys).size !== phoneKeys.length) {
        setFooterValidationError(UNIQUE_PHONE_MESSAGE);
        const oppositePhones = new Set(
          oppositeSaved.map((party) => partyPhoneUniqueKey(party.phone)),
        );
        values.parties.forEach((party, index) => {
          const key = partyPhoneUniqueKey(party.phone);
          if (
            oppositePhones.has(key) ||
            indexesWithDuplicatePhones(
              values.parties.map((entry) => partyPhoneUniqueKey(entry.phone)),
            ).includes(index)
          ) {
            setError(`parties.${index}.phone`, {
              type: "manual",
              message: UNIQUE_PHONE_MESSAGE,
            });
          }
        });
        return;
      }
      setSubmitError(null);
      setFooterValidationError(null);
      setIsSubmitting(true);
      try {
        await flushAutosave();
        await replaceLeaseAgreementParties(agreementId, { parties: merged });
        markSaved({ parties: merged });
        await queryClient.invalidateQueries({
          queryKey: ["lease-agreement", agreementId],
        });
        await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
        replaceCreateAgreementStep(
          router,
          nextStep,
          entry,
          agreementId,
          editOrigin,
        );
      } catch (error) {
        setSubmitError(
          error instanceof Error ? error.message : "Could not save parties",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    (formErrors) => {
      const phones = getValues("parties").map((party) =>
        partyPhoneUniqueKey(party.phone),
      );
      const fieldIds = fields.map((field) => field.id);
      const ids = fieldIdsToExpandForInvalidParties(
        fieldIds,
        formErrors.parties,
        phones,
      );

      const rootMessage = rootPartyErrorMessage(formErrors.parties);
      setFooterValidationError(
        rootMessage ?? "Please fix the highlighted fields before continuing.",
      );

      if (isUniquePhonePartyError(formErrors.parties)) {
        for (const index of indexesWithDuplicatePhones(phones)) {
          setError(`parties.${index}.phone`, {
            type: "manual",
            message: UNIQUE_PHONE_MESSAGE,
          });
        }
      }

      if (ids.length > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          return next;
        });
      }

      requestAnimationFrame(() => {
        if (isUniquePhonePartyError(formErrors.parties)) {
          scrollRef.current?.scrollToEnd({ animated: true });
        } else {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }
      });
    },
  );

  const onNext = () => {
    void saveParties();
  };

  const submitFromKeyboard = submitPrimaryFromKeyboard(onNext);

  const onBack = useCallback(() => {
    void (async () => {
      await flushAutosave();
      goToPreviousCreateStep(
        router,
        step,
        entry,
        agreementId,
        editOrigin,
      );
    })();
  }, [agreementId, editOrigin, entry, flushAutosave, router, step]);

  useCreateAgreementHardwareBack(onBack);

  const roleCount = fields.length;

  function renderPartyFields(index: number, fieldId: string) {
    const partyErrors = errors.parties?.[index];
    const hasErrors = partyHasFieldErrors(errors.parties, index);
    const name = parties[index]?.name ?? "";
    const showAccordionChrome = roleCount >= 2;
    /**
     * Always show fields when there's only one party of this role (no header),
     * or when the party has validation errors — never hide an errored form
     * behind a collapsed accordion (including the single-party case).
     */
    const expanded = isPartyFormExpanded({
      roleCount,
      hasErrors,
      isInExpandedSet: expandedIds.has(fieldId),
    });
    const canCollapse =
      showAccordionChrome && name.trim().length > 0 && !hasErrors;
    const headerLabel = partyCardLabel(role, index + 1, name);
    const canRemove = roleCount >= 2;

    return (
      <TintedSectionCard
        key={fieldId}
        gap={showAccordionChrome ? 16 : shape.sectionFieldGap}
      >
        {showAccordionChrome ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hasErrors
                ? `${headerLabel}, has validation errors`
                : expanded
                  ? `Collapse ${headerLabel}`
                  : `Expand ${headerLabel}`
            }
            accessibilityState={{ expanded }}
            onPress={() => {
              if (!canCollapse && expanded) return;
              if (hasErrors) return;
              toggleExpanded(fieldId);
            }}
            disabled={!canCollapse && expanded}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              paddingVertical: 4,
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {hasErrors ? (
                <View
                  accessibilityLabel="Has errors"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.colors.error,
                  }}
                />
              ) : null}
              <Text
                variant="titleMedium"
                style={{
                  color: theme.colors.headingText,
                  fontFamily: fontFamilies.robotoMedium,
                }}
              >
                {headerLabel}
              </Text>
            </View>
            {canCollapse || !expanded ? (
              <View
                accessible={false}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon
                  source={expanded ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={theme.colors.onSurfaceVariant}
                />
              </View>
            ) : null}
          </Pressable>
        ) : null}

        {expanded ? (
          <PartyExpandedTextFields
            index={index}
            control={control}
            partyErrors={partyErrors}
            isSubmitting={isSubmitting}
            getValues={getValues}
            setError={setError}
            clearErrors={clearErrors}
            onLastSubmit={submitFromKeyboard}
            canRemove={canRemove}
            onRemove={() => confirmRemoveParty(index)}
          />
        ) : null}
      </TintedSectionCard>
    );
  }

  const inlineRootMessage =
    typeof errors.parties?.message === "string"
      ? errors.parties.message
      : errors.parties?.root?.message;

  return (
    <CreateAgreementStepLayout
      step={step}
      title={title}
      agreementId={agreementId}
      entry={entry}
      editOrigin={editOrigin}
      scrollRef={scrollRef}
      onBack={onBack}
      onNext={onNext}
      nextTitle="Next step"
      isSubmitting={isSubmitting}
      autosaveStatus={autosaveStatus}
      onBeforeCancel={cancelAutosave}
      flushAutosave={flushAutosave}
      footerBanner={
        <>
          {footerValidationError ? (
            <Alert description={footerValidationError} />
          ) : null}
          {submitError ? <Alert description={submitError} /> : null}
        </>
      }
    >
      <View style={{ width: "100%", gap: 16 }}>
        {fields.map((field, index) => renderPartyFields(index, field.id))}

        <Button
          title={addButtonTitle}
          onPress={addParty}
          isDisabled={!canAddParty}
          variant="secondary"
          textColor={theme.colors.primary}
          outlineColor={theme.colors.primary}
          icon="account-plus"
        />
      </View>

      {inlineRootMessage && inlineRootMessage !== footerValidationError ? (
        <Alert description={inlineRootMessage} />
      ) : null}
    </CreateAgreementStepLayout>
  );
}

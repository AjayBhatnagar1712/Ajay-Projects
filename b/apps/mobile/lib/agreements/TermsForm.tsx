import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { View } from "react-native";
import { Text } from "react-native-paper";
import {
  patchLeaseAgreement,
  type LeaseAgreementDetail,
} from "../api/client";
import {
  type CreateAgreementEditOrigin,
  type CreateAgreementEntry,
  goToPreviousCreateStep,
  returnToCreateAgreementEditOrigin,
} from "./createAgreementNav";
import { clearCreateAgreementStepReplaceAnimation } from "./createAgreementReplaceAnimation";
import { endPreviewEditAutosaveSession } from "./previewEditAutosaveRegistry";
import { clearPreviewEditSnapshot } from "./previewEditSession";
import {
  durationMonthsFieldValue,
  durationPartsFromRange,
  formatDurationDisplay,
  endDatePickerMinDate,
  isExecutionAfterStart,
  startOfLocalToday,
} from "./dateHelpers";
import {
  paiseToRupees,
  rupeesToPaise,
  TermsStepSchema,
  type TermsStepValues,
} from "./flow";
import { destinationAfterTermsSave } from "./reviewShare";
import {
  buildTermsAutosavePatch,
  serializeAutosavePayload,
} from "./stepAutosavePayloads";
import { useAgreementStepAutosave } from "./useAgreementStepAutosave";
import { useCreateAgreementHardwareBack } from "./useCreateAgreementHardwareBack";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { CheckboxOption } from "@/lib/ui/CheckboxOption";
import { CreateAgreementStepLayout } from "@/lib/ui/CreateAgreementStepLayout";
import { DateField } from "@/lib/ui/DateField";
import {
  focusNextField,
  submitPrimaryFromKeyboard,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { MoneyField } from "@/lib/ui/MoneyField";
import { TextField } from "@/lib/ui/TextField";

type TermsFormProps = {
  agreementId: string;
  detail: LeaseAgreementDetail;
  entry: CreateAgreementEntry;
  editOrigin?: CreateAgreementEditOrigin;
};

function computedDurationDefault(
  start: string | null,
  end: string | null,
  fallback: number | null,
): string {
  if (start && end) {
    const derived = durationMonthsFieldValue(start, end);
    if (derived.length > 0) return derived;
  }
  return fallback === null ? "" : String(fallback);
}

export function TermsForm({
  agreementId,
  detail,
  entry,
  editOrigin,
}: TermsFormProps) {
  const theme = useAppTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const executionCityRef = useRef<FieldFocusHandle>(null);
  const lockInRef = useRef<FieldFocusHandle>(null);
  const noticeTenantRef = useRef<FieldFocusHandle>(null);
  const noticeOwnerRef = useRef<FieldFocusHandle>(null);
  const monthlyRentRef = useRef<FieldFocusHandle>(null);
  const securityDepositRef = useRef<FieldFocusHandle>(null);
  const brokerageFeeRef = useRef<FieldFocusHandle>(null);
  const maintenanceRef = useRef<FieldFocusHandle>(null);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<TermsStepValues>({
    resolver: zodResolver(TermsStepSchema),
    // Text/number fields validate on blur; dates/checkbox are not the blur
    // target. Conditional maintenance amount only fails when unchecked.
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      executionDate: detail.executionDate ?? "",
      effectiveDate: detail.effectiveDate ?? "",
      endDate: detail.endDate ?? "",
      executionCity: detail.executionCity ?? "",
      durationMonths: computedDurationDefault(
        detail.effectiveDate,
        detail.endDate,
        detail.durationMonths,
      ),
      minStayMonths:
        detail.minStayMonths === null ? "" : String(detail.minStayMonths),
      noticePeriodLicenseeMonths:
        detail.noticePeriodLicenseeMonths === null
          ? ""
          : String(detail.noticePeriodLicenseeMonths),
      noticePeriodLicensorMonths:
        detail.noticePeriodLicensorMonths === null
          ? ""
          : String(detail.noticePeriodLicensorMonths),
      monthlyRentRupees: paiseToRupees(detail.monthlyRentPaise),
      securityDepositRupees: paiseToRupees(detail.securityDepositPaise),
      brokerageFeeRupees: paiseToRupees(detail.brokerageFeePaise ?? null),
      maintenanceIncluded: detail.maintenanceIncluded ?? false,
      monthlyMaintenanceRupees: paiseToRupees(detail.monthlyMaintenancePaise),
      rentDueDay: "5",
    },
  });

  const watched = useWatch({ control });

  const [initialSerialized] = useState(() => {
    const patch = buildTermsAutosavePatch({
      executionDate: detail.executionDate ?? "",
      effectiveDate: detail.effectiveDate ?? "",
      endDate: detail.endDate ?? "",
      executionCity: detail.executionCity ?? "",
      durationMonths: computedDurationDefault(
        detail.effectiveDate,
        detail.endDate,
        detail.durationMonths,
      ),
      minStayMonths:
        detail.minStayMonths === null ? "" : String(detail.minStayMonths),
      noticePeriodLicenseeMonths:
        detail.noticePeriodLicenseeMonths === null
          ? ""
          : String(detail.noticePeriodLicenseeMonths),
      noticePeriodLicensorMonths:
        detail.noticePeriodLicensorMonths === null
          ? ""
          : String(detail.noticePeriodLicensorMonths),
      monthlyRentRupees: paiseToRupees(detail.monthlyRentPaise),
      securityDepositRupees: paiseToRupees(detail.securityDepositPaise),
      brokerageFeeRupees: paiseToRupees(detail.brokerageFeePaise ?? null),
      maintenanceIncluded: detail.maintenanceIncluded ?? false,
      monthlyMaintenanceRupees: paiseToRupees(detail.monthlyMaintenancePaise),
      rentDueDay: "5",
    });
    return patch ? serializeAutosavePayload(patch) : null;
  });

  const buildPayload = useCallback(
    () => buildTermsAutosavePatch(getValues()),
    [getValues],
  );

  const saveTermsAutosave = useCallback(
    async (patch: NonNullable<ReturnType<typeof buildTermsAutosavePatch>>) => {
      await patchLeaseAgreement(agreementId, patch);
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
    watched,
    buildPayload,
    save: saveTermsAutosave,
    initialSerialized,
    previewEditAgreementId: editOrigin ? agreementId : undefined,
    previewEditStepKey: "terms",
  });

  const executionDate = useWatch({ control, name: "executionDate" });
  const effectiveDate = useWatch({ control, name: "effectiveDate" });
  const endDate = useWatch({ control, name: "endDate" });
  const durationMonths = useWatch({ control, name: "durationMonths" });
  const maintenanceIncluded = useWatch({ control, name: "maintenanceIncluded" });

  // Duration is always derived from Start + End — never broker input.
  // "0" means a real range shorter than one month; schema rejects it.
  useEffect(() => {
    const next = durationMonthsFieldValue(
      effectiveDate ?? "",
      endDate ?? "",
    );
    if ((durationMonths ?? "") !== next) {
      setValue("durationMonths", next, {
        shouldValidate: next.length > 0,
        shouldDirty: true,
      });
    }
  }, [durationMonths, effectiveDate, endDate, setValue]);

  const showExecutionWarning = isExecutionAfterStart(
    executionDate ?? "",
    effectiveDate ?? "",
  );
  const todayMin = startOfLocalToday();
  const endMin = endDatePickerMinDate(effectiveDate ?? "");
  const durationParts = durationPartsFromRange(
    effectiveDate ?? "",
    endDate ?? "",
  );
  const durationPlainText =
    durationParts === null ? null : formatDurationDisplay(durationParts);

  const onComplete = handleSubmit(async (values) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await flushAutosave();
      const patch = {
        executionDate: values.executionDate,
        effectiveDate: values.effectiveDate,
        endDate: values.endDate,
        executionCity: values.executionCity,
        durationMonths: Number(values.durationMonths),
        minStayMonths: Number(values.minStayMonths),
        noticePeriodLicenseeMonths: Number(values.noticePeriodLicenseeMonths),
        noticePeriodLicensorMonths: Number(values.noticePeriodLicensorMonths),
        monthlyRentPaise: rupeesToPaise(values.monthlyRentRupees),
        securityDepositPaise: rupeesToPaise(values.securityDepositRupees),
        brokerageFeePaise:
          values.brokerageFeeRupees.trim() === ""
            ? null
            : rupeesToPaise(values.brokerageFeeRupees),
        maintenanceIncluded: values.maintenanceIncluded,
        monthlyMaintenancePaise: values.maintenanceIncluded
          ? null
          : rupeesToPaise(values.monthlyMaintenanceRupees),
        rentDueDay: 5,
      };
      await patchLeaseAgreement(agreementId, patch);
      markSaved(patch);
      await queryClient.invalidateQueries({
        queryKey: ["lease-agreement", agreementId],
      });
      await queryClient.invalidateQueries({ queryKey: ["lease-agreements"] });
      if (destinationAfterTermsSave(detail.status) === "detail-review-saved") {
        if (editOrigin) {
          clearCreateAgreementStepReplaceAnimation();
          clearPreviewEditSnapshot(agreementId);
          endPreviewEditAutosaveSession(agreementId);
        }
        router.replace({
          pathname: "/agreements/[agreementId]",
          params: { agreementId, notice: "review-saved" },
        });
        return;
      }
      if (editOrigin) {
        await queryClient.invalidateQueries({
          queryKey: ["lease-agreement-preview", agreementId],
        });
        returnToCreateAgreementEditOrigin(router, agreementId, entry, editOrigin);
        return;
      }
      router.push({
        pathname: "/agreements/[agreementId]/preview",
        params: { agreementId, entry },
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Could not save agreement details",
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  const submitFromKeyboard = submitPrimaryFromKeyboard(() => void onComplete());

  const onBack = useCallback(() => {
    void (async () => {
      await flushAutosave();
      goToPreviousCreateStep(router, 5, entry, agreementId, editOrigin);
    })();
  }, [agreementId, editOrigin, entry, flushAutosave, router]);

  useCreateAgreementHardwareBack(onBack);

  function sectionLabel(label: string) {
    return (
      <Text
        variant="labelMedium"
        style={{
          color: theme.colors.primary,
          fontFamily: fontFamilies.robotoMedium,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    );
  }

  function sectionCard(children: ReactNode) {
    return (
      <View
        style={{
          width: "100%",
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: shape.radiusCard,
          padding: 12,
          gap: shape.sectionFieldGap,
        }}
      >
        {children}
      </View>
    );
  }

  return (
    <CreateAgreementStepLayout
      step={5}
      title="Agreement details"
      agreementId={agreementId}
      entry={entry}
      editOrigin={editOrigin}
      onBack={onBack}
      onNext={() => void onComplete()}
      nextTitle="Finish"
      isSubmitting={isSubmitting}
      autosaveStatus={autosaveStatus}
      onBeforeCancel={cancelAutosave}
      flushAutosave={flushAutosave}
    >
      <View style={{ width: "100%", gap: shape.sectionStackGap }}>
      {sectionCard(
        <>
          {sectionLabel("Dates")}
          <Controller
            control={control}
            name="executionDate"
            render={({ field: { onChange, value } }) => (
              <DateField
                label="Agreement execution date"
                value={value}
                onChange={onChange}
                isDisabled={isSubmitting}
                minDate={todayMin}
                error={errors.executionDate?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="effectiveDate"
            render={({ field: { onChange, value } }) => (
              <DateField
                label="Start date"
                value={value}
                onChange={onChange}
                isDisabled={isSubmitting}
                minDate={todayMin}
                error={errors.effectiveDate?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="endDate"
            render={({ field: { onChange, value } }) => (
              <DateField
                label="End date"
                value={value}
                onChange={onChange}
                isDisabled={isSubmitting}
                minDate={endMin}
                error={errors.endDate?.message}
              />
            )}
          />
          {showExecutionWarning ? (
            <Alert
              color="notice"
              description="Agreement execution date is after the start date. Unusual, but you can still continue."
            />
          ) : null}
          {durationPlainText ? (
            <Text
              accessibilityRole="text"
              accessibilityLabel={durationPlainText}
              variant="bodyLarge"
              style={{
                color: theme.colors.onSurface,
                fontFamily: fontFamilies.robotoRegular,
              }}
            >
              {durationPlainText}
            </Text>
          ) : null}
          {errors.durationMonths?.message ? (
            <Alert description={errors.durationMonths.message} />
          ) : null}
          <Controller
            control={control}
            name="executionCity"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                ref={executionCityRef}
                label="City"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                isDisabled={isSubmitting}
                autoCapitalize="characters"
                placeholder="BENGALURU"
                error={errors.executionCity?.message}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={focusNextField(lockInRef)}
              />
            )}
          />
        </>,
      )}

      {sectionCard(
        <>
          {sectionLabel("Lock-in & notice")}
          <Controller
            control={control}
            name="minStayMonths"
            render={({ field: { onBlur, onChange, value } }) => (
              <TextField
                ref={lockInRef}
                label="Lock-in period"
                value={value}
                onBlur={onBlur}
                onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
                isDisabled={isSubmitting}
                keyboardType="number"
                placeholder="6"
                suffix="months"
                error={errors.minStayMonths?.message}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={focusNextField(noticeTenantRef)}
              />
            )}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="noticePeriodLicenseeMonths"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={noticeTenantRef}
                    label="Notice (tenant)"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
                    isDisabled={isSubmitting}
                    keyboardType="number"
                    placeholder="2"
                    suffix="months"
                    error={errors.noticePeriodLicenseeMonths?.message}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(noticeOwnerRef)}
                  />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name="noticePeriodLicensorMonths"
                render={({ field: { onBlur, onChange, value } }) => (
                  <TextField
                    ref={noticeOwnerRef}
                    label="Notice (owner)"
                    value={value}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
                    isDisabled={isSubmitting}
                    keyboardType="number"
                    placeholder="3"
                    suffix="months"
                    error={errors.noticePeriodLicensorMonths?.message}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={focusNextField(monthlyRentRef)}
                  />
                )}
              />
            </View>
          </View>
        </>,
      )}

      {sectionCard(
        <>
          {sectionLabel("Rent details")}
          <Controller
            control={control}
            name="monthlyRentRupees"
            render={({ field: { onBlur, onChange, value } }) => (
              <MoneyField
                ref={monthlyRentRef}
                label="Monthly rent"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                isDisabled={isSubmitting}
                placeholder="45,000"
                error={errors.monthlyRentRupees?.message}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={focusNextField(securityDepositRef)}
              />
            )}
          />
          <Controller
            control={control}
            name="securityDepositRupees"
            render={({ field: { onBlur, onChange, value } }) => (
              <MoneyField
                ref={securityDepositRef}
                label="Security deposit"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                isDisabled={isSubmitting}
                placeholder="1,35,000"
                error={errors.securityDepositRupees?.message}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={focusNextField(brokerageFeeRef)}
              />
            )}
          />
          <Controller
            control={control}
            name="brokerageFeeRupees"
            render={({ field: { onBlur, onChange, value } }) => (
              <MoneyField
                ref={brokerageFeeRef}
                label="Consultancy fee (optional)"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                isDisabled={isSubmitting}
                placeholder="45,000"
                error={errors.brokerageFeeRupees?.message}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={
                  maintenanceIncluded
                    ? submitFromKeyboard
                    : focusNextField(maintenanceRef)
                }
              />
            )}
          />
          <Controller
            control={control}
            name="maintenanceIncluded"
            render={({ field: { onChange, value } }) => (
              <CheckboxOption
                label="Maintenance included in rent"
                isChecked={value}
                onChange={onChange}
                isDisabled={isSubmitting}
              />
            )}
          />
          <Controller
            control={control}
            name="monthlyMaintenanceRupees"
            render={({ field: { onBlur, onChange, value } }) => (
              <MoneyField
                ref={maintenanceRef}
                label="Monthly maintenance"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                isDisabled={isSubmitting || maintenanceIncluded}
                placeholder="3,000"
                error={
                  maintenanceIncluded
                    ? undefined
                    : errors.monthlyMaintenanceRupees?.message
                }
                returnKeyType="done"
                onSubmitEditing={submitFromKeyboard}
              />
            )}
          />
          <Text>Monthly rent payable by the 5th</Text>
        </>,
      )}
      </View>

      {submitError ? <Alert description={submitError} /> : null}
    </CreateAgreementStepLayout>
  );
}

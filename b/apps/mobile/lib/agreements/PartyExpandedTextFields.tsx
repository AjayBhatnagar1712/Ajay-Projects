import { useRef } from "react";
import {
  Controller,
  type Control,
  type UseFormClearErrors,
  type UseFormGetValues,
  type UseFormSetError,
} from "react-hook-form";
import { View } from "react-native";
import type { LeasePartiesReplace } from "@workspace/api-schemas";
import {
  aadhaarBlurError,
  aadhaarChangeError,
  addressBlurError,
  ageBlurError,
  emailBlurError,
  nameBlurError,
} from "@/lib/agreements/partyFieldValidation";
import { normalizeAadhaarInput } from "@/lib/agreements/partyCardHelpers";
import { shape } from "@/lib/theme/shape";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import {
  focusNextField,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { FilterChipGroup } from "@/lib/ui/FilterChipGroup";
import { PartyPhoneField } from "@/lib/ui/PartyPhoneField";
import { TextAreaField } from "@/lib/ui/TextAreaField";
import { TextField } from "@/lib/ui/TextField";

const TITLES = [
  { value: "Mr.", label: "Mr." },
  { value: "Ms.", label: "Ms." },
  { value: "Mrs.", label: "Mrs." },
] as const;

type PartyFieldErrors = {
  title?: { message?: string };
  name?: { message?: string };
  age?: { message?: string };
  address?: { message?: string };
  aadhaar?: { message?: string };
  pan?: { message?: string };
  email?: { message?: string };
  phone?: { message?: string };
};

type Props = {
  index: number;
  control: Control<LeasePartiesReplace>;
  partyErrors: PartyFieldErrors | undefined;
  isSubmitting: boolean;
  getValues: UseFormGetValues<LeasePartiesReplace>;
  setError: UseFormSetError<LeasePartiesReplace>;
  clearErrors: UseFormClearErrors<LeasePartiesReplace>;
  onLastSubmit: () => void;
  canRemove: boolean;
  onRemove: () => void;
};

/**
 * Apply a single-field blur message without running form-wide Zod (which would
 * light up every empty required party field at once).
 */
function applyFieldBlurError(
  setError: UseFormSetError<LeasePartiesReplace>,
  clearErrors: UseFormClearErrors<LeasePartiesReplace>,
  name:
    | `parties.${number}.name`
    | `parties.${number}.age`
    | `parties.${number}.address`
    | `parties.${number}.aadhaar`
    | `parties.${number}.email`,
  message: string | null,
): void {
  if (message) {
    setError(name, { type: "manual", message });
  } else {
    clearErrors(name);
  }
}

/**
 * Expanded party text fields with keyboard Next chaining within the card.
 * Title chips are not text inputs (no blank-on-blur). Phone is last and
 * triggers the form CTA. PAN is optional — blank never errors on blur.
 */
export function PartyExpandedTextFields({
  index,
  control,
  partyErrors,
  isSubmitting,
  getValues,
  setError,
  clearErrors,
  onLastSubmit,
  canRemove,
  onRemove,
}: Props) {
  const theme = useAppTheme();
  const nameRef = useRef<FieldFocusHandle>(null);
  const ageRef = useRef<FieldFocusHandle>(null);
  const addressRef = useRef<FieldFocusHandle>(null);
  const aadhaarRef = useRef<FieldFocusHandle>(null);
  const panRef = useRef<FieldFocusHandle>(null);
  const emailRef = useRef<FieldFocusHandle>(null);
  const phoneRef = useRef<FieldFocusHandle>(null);

  return (
    <View style={{ width: "100%", gap: shape.fieldStackGap }}>
      <Controller
        control={control}
        name={`parties.${index}.title`}
        render={({ field: titleField }) => (
          <FilterChipGroup
            label="Title"
            value={titleField.value ?? ""}
            options={TITLES}
            onChange={(value) => titleField.onChange(value)}
            isDisabled={isSubmitting}
          />
        )}
      />
      {partyErrors?.title ? (
        <Alert description={partyErrors.title.message ?? "Required"} />
      ) : null}

      <Controller
        control={control}
        name={`parties.${index}.name`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextField
            ref={nameRef}
            label="Name"
            value={value}
            onBlur={() => {
              onBlur();
              applyFieldBlurError(
                setError,
                clearErrors,
                `parties.${index}.name`,
                nameBlurError(getValues(`parties.${index}.name`)),
              );
            }}
            onChangeText={(text) => {
              onChange(text);
              clearErrors(`parties.${index}.name`);
            }}
            isDisabled={isSubmitting}
            autoCapitalize="words"
            placeholder="Full legal name"
            error={partyErrors?.name?.message}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={focusNextField(ageRef)}
          />
        )}
      />

      <Controller
        control={control}
        name={`parties.${index}.age`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextField
            ref={ageRef}
            label="Age"
            value={value === null || value === undefined ? "" : String(value)}
            onBlur={() => {
              onBlur();
              applyFieldBlurError(
                setError,
                clearErrors,
                `parties.${index}.age`,
                ageBlurError(getValues(`parties.${index}.age`)),
              );
            }}
            onChangeText={(text) => {
              onChange(
                text.length === 0 ? null : Number(text.replace(/\D/g, "")),
              );
              clearErrors(`parties.${index}.age`);
            }}
            isDisabled={isSubmitting}
            keyboardType="number"
            placeholder="36"
            error={partyErrors?.age?.message}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={focusNextField(addressRef)}
          />
        )}
      />

      <Controller
        control={control}
        name={`parties.${index}.address`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextAreaField
            ref={addressRef}
            label="Current address (as per Aadhaar Card)"
            value={value ?? ""}
            onBlur={() => {
              onBlur();
              applyFieldBlurError(
                setError,
                clearErrors,
                `parties.${index}.address`,
                addressBlurError(getValues(`parties.${index}.address`)),
              );
            }}
            onChangeText={(text) => {
              onChange(text.length === 0 ? null : text);
              clearErrors(`parties.${index}.address`);
            }}
            isDisabled={isSubmitting}
            placeholder="Full address"
            error={partyErrors?.address?.message}
            returnKeyType="next"
            blurOnSubmit
            onSubmitEditing={focusNextField(aadhaarRef)}
          />
        )}
      />

      <Controller
        control={control}
        name={`parties.${index}.aadhaar`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextField
            ref={aadhaarRef}
            label="Aadhaar Number"
            value={value ?? ""}
            onBlur={() => {
              onBlur();
              applyFieldBlurError(
                setError,
                clearErrors,
                `parties.${index}.aadhaar`,
                aadhaarBlurError(getValues(`parties.${index}.aadhaar`)),
              );
            }}
            onChangeText={(text) => {
              const next = normalizeAadhaarInput(text);
              onChange(next);
              const message = aadhaarChangeError(next);
              if (message) {
                setError(`parties.${index}.aadhaar`, {
                  type: "manual",
                  message,
                });
              } else {
                clearErrors(`parties.${index}.aadhaar`);
              }
            }}
            isDisabled={isSubmitting}
            keyboardType="number"
            maxCharacters={12}
            placeholder="12 digits"
            error={partyErrors?.aadhaar?.message}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={focusNextField(panRef)}
          />
        )}
      />

      <Controller
        control={control}
        name={`parties.${index}.pan`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextField
            ref={panRef}
            label="PAN"
            value={value ?? ""}
            onBlur={onBlur}
            onChangeText={(text) =>
              onChange(text.length === 0 ? null : text)
            }
            isDisabled={isSubmitting}
            autoCapitalize="characters"
            necessityIndicator="optional"
            placeholder="AAAAA9999A"
            error={partyErrors?.pan?.message}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={focusNextField(emailRef)}
          />
        )}
      />

      <Controller
        control={control}
        name={`parties.${index}.email`}
        render={({ field: { onBlur, onChange, value } }) => (
          <TextField
            ref={emailRef}
            label="Email Address"
            value={value ?? ""}
            onBlur={() => {
              onBlur();
              applyFieldBlurError(
                setError,
                clearErrors,
                `parties.${index}.email`,
                emailBlurError(getValues(`parties.${index}.email`)),
              );
            }}
            onChangeText={(text) => {
              onChange(text.length === 0 ? null : text);
              clearErrors(`parties.${index}.email`);
            }}
            isDisabled={isSubmitting}
            keyboardType="email"
            autoCapitalize="none"
            placeholder="name@example.com"
            error={partyErrors?.email?.message}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={focusNextField(phoneRef)}
          />
        )}
      />

      <Controller
        control={control}
        name={`parties.${index}.phone`}
        render={({ field: { onBlur, onChange, value } }) => (
          <PartyPhoneField
            ref={phoneRef}
            label="Phone Number"
            value={value}
            onBlur={onBlur}
            onChange={onChange}
            onValidationMessage={(message) => {
              if (message) {
                setError(`parties.${index}.phone`, {
                  type: "manual",
                  message,
                });
              } else {
                clearErrors(`parties.${index}.phone`);
              }
            }}
            isDisabled={isSubmitting}
            error={partyErrors?.phone?.message}
            returnKeyType="next"
            onSubmitEditing={onLastSubmit}
          />
        )}
      />

      {canRemove ? (
        <Button
          title="Remove"
          icon="delete-outline"
          onPress={onRemove}
          isDisabled={isSubmitting}
          variant="tertiary"
          isFullWidth={false}
          textColor={theme.colors.error}
        />
      ) : null}
    </View>
  );
}

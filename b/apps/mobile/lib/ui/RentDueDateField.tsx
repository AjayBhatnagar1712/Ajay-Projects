import { forwardRef } from "react";
import type { ReturnKeyTypeOptions } from "react-native";
import {
  rentDueDateFieldSuffix,
} from "@/lib/agreements/dateHelpers";
import { parseRentDueDayInput } from "@/lib/agreements/rentDueDateFormat";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import { TextField } from "@/lib/ui/TextField";

type Props = {
  label?: string;
  /** Raw day digits only — the sole editable value. */
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  isDisabled?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
};

/**
 * Rent due day — identical structure to Notice (TextField + trailing Affix).
 * Suffix appears only for a valid 1–31 day; digits are range-clamped on change.
 */
export const RentDueDateField = forwardRef<FieldFocusHandle, Props>(
  function RentDueDateField(
    {
      label = "Rent due date",
      value,
      onChangeText,
      onBlur,
      error,
      isDisabled = false,
      returnKeyType,
      onSubmitEditing,
      blurOnSubmit,
    },
    ref,
  ) {
    const suffix = rentDueDateFieldSuffix(value) ?? undefined;

    return (
      <TextField
        ref={ref}
        label={label}
        value={value}
        onBlur={onBlur}
        onChangeText={(text) => onChangeText(parseRentDueDayInput(text))}
        isDisabled={isDisabled}
        keyboardType="number"
        selectTextOnFocus
        maxCharacters={2}
        suffix={suffix}
        error={error}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={blurOnSubmit}
      />
    );
  },
);

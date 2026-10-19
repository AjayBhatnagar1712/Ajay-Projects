import { useState } from "react";
import { Pressable, View } from "react-native";
import { HelperText, TextInput } from "react-native-paper";
import {
  DatePickerModal,
  enGB,
  registerTranslation,
} from "react-native-paper-dates";
import {
  datePickerYearBounds,
  formatIsoDateDisplay,
  parseIsoDate,
  startOfLocalToday,
  toIsoDate,
} from "@/lib/agreements/dateHelpers";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import {
  outlinedFieldContentStyle,
  outlinedFieldStyle,
} from "@/lib/ui/outlinedFieldChrome";

// Paper Dates is pure JS / Expo-compatible; register once at module load.
registerTranslation("en-GB", enGB);

type Props = {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  error?: string;
  helperText?: string;
  isDisabled?: boolean;
  placeholder?: string;
  /** Earliest selectable calendar day (inclusive). */
  minDate?: Date;
};

/**
 * Date field backed by react-native-paper-dates DatePickerModal.
 * Shares outlined floating-label chrome with TextField / SelectField.
 * Year picker is current year and later (startYear/endYear).
 * Stores ISO YYYY-MM-DD; displays DD/MM/YYYY.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  helperText,
  isDisabled = false,
  placeholder = "DD/MM/YYYY",
  minDate,
}: Props) {
  const theme = useAppTheme();
  const [open, setOpen] = useState(false);

  const selected = parseIsoDate(value);
  const display = formatIsoDateDisplay(value);
  const announcedDate = display.length > 0 ? display : placeholder;
  const yearBounds = datePickerYearBounds(startOfLocalToday());

  return (
    <View style={{ width: "100%" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${announcedDate}`}
        accessibilityHint="Opens date picker"
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={() => {
          if (!isDisabled) setOpen(true);
        }}
      >
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={label}
            value={display}
            editable={false}
            disabled={isDisabled}
            error={Boolean(error)}
            right={<TextInput.Icon icon="calendar" />}
            style={outlinedFieldStyle(theme)}
            contentStyle={outlinedFieldContentStyle}
          />
        </View>
      </Pressable>

      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : helperText ? (
        <HelperText type="info" visible>
          {helperText}
        </HelperText>
      ) : null}

      <DatePickerModal
        locale="en-GB"
        mode="single"
        visible={open}
        date={selected ?? undefined}
        validRange={minDate ? { startDate: minDate } : undefined}
        onDismiss={() => setOpen(false)}
        onConfirm={({ date }) => {
          setOpen(false);
          if (date) onChange(toIsoDate(date));
        }}
        label={label}
        saveLabel="Save"
        presentationStyle="pageSheet"
        startYear={yearBounds.startYear}
        endYear={yearBounds.endYear}
      />
    </View>
  );
}

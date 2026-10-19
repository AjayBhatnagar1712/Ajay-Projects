import { forwardRef, useImperativeHandle, useRef } from "react";
import { View, type ReturnKeyTypeOptions } from "react-native";
import { HelperText, TextInput } from "react-native-paper";
import {
  formatRupeesDisplay,
  parseRupeesInput,
} from "@/lib/agreements/moneyFormat";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import {
  outlinedFieldContentStyle,
  outlinedFieldStyle,
} from "@/lib/ui/outlinedFieldChrome";

type Props = {
  label: string;
  /** Canonical digit string for the form (no grouping), e.g. `"45000"`. */
  value: string;
  onChangeText: (canonical: string) => void;
  onBlur?: () => void;
  error?: string;
  /**
   * Not rendered — floating-label fields stay empty when focused (label only).
   * Kept optional so existing call sites keep compiling.
   */
  placeholder?: string;
  isDisabled?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
};

/**
 * Money field with ₹ prefix and live en-IN thousands separators.
 * Shares outlined floating-label chrome with TextField.
 * Stores/submits the unformatted digit string for existing paise conversion.
 */
export const MoneyField = forwardRef<FieldFocusHandle, Props>(
  function MoneyField(
    {
      label,
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
    const theme = useAppTheme();
    const inputRef = useRef<FieldFocusHandle | null>(null);
    const display = formatRupeesDisplay(value);

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus();
      },
      measureInWindow: (callback) => {
        const node = inputRef.current as
          | (FieldFocusHandle & {
              measureInWindow?: FieldFocusHandle["measureInWindow"];
            })
          | null;
        node?.measureInWindow?.(callback);
      },
    }));

    return (
      <View style={{ width: "100%" }}>
        <TextInput
          ref={(node: FieldFocusHandle | null) => {
            inputRef.current = node;
          }}
          mode="outlined"
          label={label}
          value={display}
          onChangeText={(text) => onChangeText(parseRupeesInput(text))}
          onBlur={() => onBlur?.()}
          disabled={isDisabled}
          error={Boolean(error)}
          keyboardType="numeric"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          left={
            <TextInput.Affix
              text="₹"
              textStyle={{
                color: theme.colors.onSurface,
                fontFamily: fontFamilies.robotoRegular,
                fontSize: 16,
              }}
            />
          }
          accessibilityLabel={`${label}, ${display.length > 0 ? `${display} rupees` : "empty"}`}
          style={outlinedFieldStyle(theme)}
          contentStyle={outlinedFieldContentStyle}
        />
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
      </View>
    );
  },
);

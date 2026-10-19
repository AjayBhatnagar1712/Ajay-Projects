import { forwardRef, useImperativeHandle, useRef } from "react";
import { View, type ReturnKeyTypeOptions } from "react-native";
import { HelperText, TextInput } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import {
  outlinedFieldContentStyle,
  outlinedFieldStyle,
} from "@/lib/ui/outlinedFieldChrome";

type InputType = "text" | "telephone" | "email" | "url" | "number" | "search";

const KEYBOARD_TYPE = {
  text: "default",
  telephone: "phone-pad",
  email: "email-address",
  url: "url",
  number: "numeric",
  search: "default",
} as const;

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  /**
   * Not rendered — floating-label fields stay empty when focused (label only).
   * Kept optional so existing call sites keep compiling.
   */
  placeholder?: string;
  isDisabled?: boolean;
  /** Drives the native keyboard. */
  keyboardType?: InputType;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxCharacters?: number;
  necessityIndicator?: "optional" | "required" | "none";
  /** Select existing text on focus — preferred for short numeric fields. */
  selectTextOnFocus?: boolean;
  /** Trailing affix inside the outlined field (e.g. "months"). */
  suffix?: string;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
};

/**
 * Shared text field — Paper outlined mode with animated floating label
 * (same chrome as MoneyField). App-wide default for single-line text entry.
 *
 * `necessityIndicator` marks optional fields or appends `*` to required fields.
 */
export const TextField = forwardRef<FieldFocusHandle, Props>(function TextField(
  {
    label,
    value,
    onChangeText,
    onBlur,
    error,
    isDisabled = false,
    keyboardType = "text",
    autoCapitalize,
    maxCharacters,
    necessityIndicator = "none",
    selectTextOnFocus = false,
    suffix,
    returnKeyType,
    onSubmitEditing,
    blurOnSubmit,
  },
  ref,
) {
  const theme = useAppTheme();
  const inputRef = useRef<FieldFocusHandle | null>(null);

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

  const decoratedLabel =
    necessityIndicator === "optional"
      ? `${label} (optional)`
      : necessityIndicator === "required"
        ? `${label} *`
        : label;

  return (
    <View style={{ width: "100%" }}>
      <TextInput
        ref={(node: FieldFocusHandle | null) => {
          inputRef.current = node;
        }}
        mode="outlined"
        label={decoratedLabel}
        value={value}
        onChangeText={onChangeText}
        onBlur={() => onBlur?.()}
        disabled={isDisabled}
        error={Boolean(error)}
        keyboardType={KEYBOARD_TYPE[keyboardType]}
        autoCapitalize={autoCapitalize}
        maxLength={maxCharacters}
        selectTextOnFocus={selectTextOnFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={blurOnSubmit}
        right={
          suffix ? (
            <TextInput.Affix
              text={suffix}
              textStyle={{
                color: theme.colors.onSurfaceVariant,
                fontFamily: fontFamilies.robotoRegular,
                fontSize: 14,
              }}
            />
          ) : undefined
        }
        accessibilityLabel={
          suffix ? `${decoratedLabel}, ${suffix}` : decoratedLabel
        }
        style={outlinedFieldStyle(theme)}
        contentStyle={outlinedFieldContentStyle}
      />
      {error ? (
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
});

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { View, type ReturnKeyTypeOptions } from "react-native";
import { HelperText, TextInput } from "react-native-paper";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import {
  outlinedFieldContentStyle,
  outlinedFieldStyle,
} from "@/lib/ui/outlinedFieldChrome";
import {
  TEXT_AREA_DEFAULT_LINES,
  textAreaContentMinHeight,
} from "@/lib/ui/textAreaFieldChrome";

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  /** Non-error supporting copy under the field (e.g. address guidance). */
  helperText?: string;
  /**
   * Not rendered — floating-label fields stay empty when focused (label only).
   * Kept optional so existing call sites keep compiling.
   */
  placeholder?: string;
  isDisabled?: boolean;
  necessityIndicator?: "optional" | "required" | "none";
  /** Focus after layout (e.g. newly added inventory row). */
  autoFocus?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  /**
   * When chaining with returnKeyType="next", set true so Return advances
   * focus instead of inserting a newline.
   */
  blurOnSubmit?: boolean;
  /**
   * Visible line count (and matching min/max height). Default 4 for address
   * fields; pass 2 for compact inventory description.
   */
  numberOfLines?: number;
};

/**
 * Multiline outlined field — same floating-label chrome as TextField / MoneyField.
 *
 * `necessityIndicator` marks optional fields or appends `*` to required fields.
 */
export const TextAreaField = forwardRef<FieldFocusHandle, Props>(
  function TextAreaField(
    {
      label,
      value,
      onChangeText,
      onBlur,
      error,
      helperText,
      isDisabled = false,
      necessityIndicator = "none",
      autoFocus = false,
      returnKeyType,
      onSubmitEditing,
      blurOnSubmit,
      numberOfLines = TEXT_AREA_DEFAULT_LINES,
    },
    ref,
  ) {
    const theme = useAppTheme();
    const inputRef = useRef<FieldFocusHandle | null>(null);
    const decoratedLabel =
      necessityIndicator === "optional"
        ? `${label} (optional)`
        : necessityIndicator === "required"
          ? `${label} *`
          : label;

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

    useEffect(() => {
      if (!autoFocus || isDisabled) return;

      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const frame = requestAnimationFrame(() => {
        timer = setTimeout(() => {
          if (!cancelled) inputRef.current?.focus();
        }, 100);
      });

      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
        if (timer !== undefined) clearTimeout(timer);
      };
    }, [autoFocus, isDisabled]);

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
          multiline
          numberOfLines={numberOfLines}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          accessibilityLabel={decoratedLabel}
          style={outlinedFieldStyle(theme)}
          contentStyle={[
            outlinedFieldContentStyle,
            {
              minHeight: textAreaContentMinHeight(numberOfLines),
              maxHeight: textAreaContentMinHeight(numberOfLines),
            },
          ]}
        />
        {error ? (
          <HelperText type="error" visible accessibilityLiveRegion="polite">
            {error}
          </HelperText>
        ) : null}
        {!error && helperText ? (
          <HelperText type="info" visible>
            {helperText}
          </HelperText>
        ) : null}
      </View>
    );
  },
);

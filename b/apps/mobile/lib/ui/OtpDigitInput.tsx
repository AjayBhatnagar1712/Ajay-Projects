import { useEffect, useRef, useState } from "react";
import {
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  TextInput,
  View,
} from "react-native";
import { HelperText } from "react-native-paper";
import { digitsOnly } from "@/lib/auth/phoneDisplay";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { quietElevation } from "@/lib/ui/elevation";

const OTP_LENGTH = 6;
const BOX_HEIGHT = 56;
const BOX_GAP = 6;

type Props = {
  value: string;
  onChange: (token: string) => void;
  /** Fires once when all six digits are present. */
  onComplete?: (token: string) => void;
  error?: string;
  isDisabled?: boolean;
};

function toSlots(token: string): string[] {
  const digits = digitsOnly(token, OTP_LENGTH).split("");
  return Array.from({ length: OTP_LENGTH }, (_, i) => digits[i] ?? "");
}

function fromSlots(slots: string[]): string {
  return slots.join("").slice(0, OTP_LENGTH);
}

/**
 * Six equal digit boxes. Flex + absolute inputs so RN Web cannot inflate
 * columns past the parent (HTML <input> defaults to ~20ch otherwise).
 */
export function OtpDigitInput({
  value,
  onChange,
  onComplete,
  error,
  isDisabled = false,
}: Props) {
  const theme = useAppTheme();
  const refs = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const completedRef = useRef<string | null>(null);
  const slots = toSlots(value);

  useEffect(() => {
    const token = digitsOnly(value, OTP_LENGTH);
    if (token.length === OTP_LENGTH) {
      if (completedRef.current !== token) {
        completedRef.current = token;
        onComplete?.(token);
      }
    } else {
      completedRef.current = null;
    }
  }, [value, onComplete]);

  function writeSlots(next: string[], focusIndex: number): void {
    onChange(fromSlots(next));
    const clamped = Math.max(0, Math.min(focusIndex, OTP_LENGTH - 1));
    requestAnimationFrame(() => refs.current[clamped]?.focus());
  }

  function handleChange(index: number, text: string): void {
    const incoming = digitsOnly(text, OTP_LENGTH);
    const next = [...slots];

    if (incoming.length === 0) {
      next[index] = "";
      writeSlots(next, index);
      return;
    }

    if (incoming.length > 1) {
      for (let i = 0; i < incoming.length && index + i < OTP_LENGTH; i += 1) {
        next[index + i] = incoming[i] ?? "";
      }
      writeSlots(next, Math.min(index + incoming.length, OTP_LENGTH - 1));
      return;
    }

    next[index] = incoming;
    writeSlots(next, index < OTP_LENGTH - 1 ? index + 1 : index);
  }

  function handleKeyPress(
    index: number,
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ): void {
    if (event.nativeEvent.key !== "Backspace") return;
    const next = [...slots];

    if (next[index]) {
      next[index] = "";
      writeSlots(next, index);
      return;
    }
    if (index > 0) {
      next[index - 1] = "";
      writeSlots(next, index - 1);
    }
  }

  return (
    <View style={{ width: "100%", maxWidth: "100%", gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          width: "100%",
          maxWidth: "100%",
          gap: BOX_GAP,
        }}
      >
        {slots.map((digit, index) => {
          const focused = focusedIndex === index;
          const borderColor = error
            ? theme.colors.error
            : focused
              ? theme.colors.primary
              : theme.colors.outline;
          const borderWidth = focused || error ? 2 : 1;
          const backgroundColor = error
            ? theme.colors.errorContainer
            : theme.colors.surface;
          const digitColor = error
            ? theme.colors.onErrorContainer
            : theme.colors.headingText;

          return (
            <View
              key={index}
              style={[
                quietElevation,
                {
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 0,
                  minWidth: 0,
                  height: BOX_HEIGHT,
                  minHeight: 44,
                  borderRadius: shape.radiusInput,
                  borderWidth,
                  borderColor,
                  backgroundColor,
                  overflow: "hidden",
                  position: "relative",
                },
              ]}
            >
              <TextInput
                ref={(node) => {
                  refs.current[index] = node;
                }}
                value={digit}
                onChangeText={(text) => handleChange(index, text)}
                onKeyPress={(event) => handleKeyPress(index, event)}
                onFocus={() => setFocusedIndex(index)}
                editable={!isDisabled}
                keyboardType="number-pad"
                textContentType={index === 0 ? "oneTimeCode" : "none"}
                autoComplete={index === 0 ? "sms-otp" : "off"}
                maxLength={OTP_LENGTH}
                selectTextOnFocus
                caretHidden
                accessibilityLabel={`Digit ${index + 1} of ${OTP_LENGTH}`}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: "100%",
                  height: "100%",
                  textAlign: "center",
                  fontSize: 20,
                  fontFamily: fontFamilies.robotoMedium,
                  color: digitColor,
                  padding: 0,
                  margin: 0,
                }}
              />
            </View>
          );
        })}
      </View>
      {error ? (
        <HelperText type="error" visible accessibilityLiveRegion="assertive">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

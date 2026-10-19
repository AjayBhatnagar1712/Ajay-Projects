import { forwardRef, useState } from "react";
import { Pressable, View, type ReturnKeyTypeOptions } from "react-native";
import { Icon, Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { shape } from "@/lib/theme/paperTheme";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import type { FieldFocusHandle } from "@/lib/ui/fieldFocusChain";
import { TextField } from "@/lib/ui/TextField";

type Props = {
  pincodes: string[];
  onChange: (next: string[]) => void;
  isDisabled?: boolean;
  error?: string;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  blurOnSubmit?: boolean;
};

const CHIP_MIN = 44;

/**
 * Pincode entry: text field + removable chips. Commits on 6 digits or blur.
 */
export const PincodeChipField = forwardRef<FieldFocusHandle, Props>(
  function PincodeChipField(
    {
      pincodes,
      onChange,
      isDisabled = false,
      error,
      returnKeyType,
      onSubmitEditing,
      blurOnSubmit,
    },
    ref,
  ) {
    const theme = useAppTheme();
    const [draft, setDraft] = useState("");

    function commit(raw: string): void {
      const digits = raw.replace(/\D/g, "").slice(0, 6);
      if (digits.length !== 6) {
        setDraft(digits);
        return;
      }
      if (!pincodes.includes(digits)) {
        onChange([...pincodes, digits]);
      }
      setDraft("");
    }

    function remove(code: string): void {
      onChange(pincodes.filter((item) => item !== code));
    }

    return (
      <View style={{ width: "100%", gap: 12 }}>
        <TextField
          ref={ref}
          label="Pincodes"
          necessityIndicator="required"
          value={draft}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, "").slice(0, 6);
            setDraft(digits);
            if (digits.length === 6) commit(digits);
          }}
          onBlur={() => commit(draft)}
          keyboardType="number"
          isDisabled={isDisabled}
          placeholder="Add pincode"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
        />
        {pincodes.length > 0 ? (
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
            accessibilityLabel={`Selected pincodes: ${pincodes.join(", ")}`}
          >
            {pincodes.map((code) => (
              <View
                key={code}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  minHeight: CHIP_MIN,
                  paddingLeft: 12,
                  paddingRight: 4,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  backgroundColor: theme.colors.surface,
                }}
              >
                <Text
                  variant="bodyMedium"
                  style={{
                    color: theme.colors.headingText,
                    fontFamily: fontFamilies.robotoRegular,
                  }}
                >
                  {code}
                </Text>
                <Pressable
                  onPress={() => remove(code)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove pincode ${code}`}
                  hitSlop={4}
                  style={{
                    minWidth: CHIP_MIN,
                    minHeight: CHIP_MIN,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: shape.radiusChip,
                  }}
                >
                  <Icon
                    source="close"
                    size={18}
                    color={theme.colors.onSurfaceVariant}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {error ? (
          <Text
            variant="bodySmall"
            style={{
              color: theme.colors.error,
              fontFamily: fontFamilies.robotoRegular,
            }}
          >
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

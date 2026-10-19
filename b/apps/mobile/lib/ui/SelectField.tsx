import { useState } from "react";
import { Pressable, View } from "react-native";
import { HelperText, Menu, TextInput } from "react-native-paper";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import {
  outlinedFieldContentStyle,
  outlinedFieldStyle,
} from "@/lib/ui/outlinedFieldChrome";

type Props = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  isDisabled?: boolean;
};

/**
 * Single-select with the same outlined floating-label chrome as TextField.
 * Paper Menu for options; TextInput is display-only (not editable).
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  onBlur,
  error,
  placeholder = "Select",
  isDisabled = false,
}: Props) {
  const theme = useAppTheme();
  const [visible, setVisible] = useState(false);
  const display = value.trim().length > 0 ? value : "";

  return (
    <View style={{ width: "100%" }}>
      <Menu
        visible={visible}
        onDismiss={() => {
          setVisible(false);
          onBlur?.();
        }}
        anchor={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${display.length > 0 ? display : placeholder}`}
            accessibilityState={{ disabled: isDisabled, expanded: visible }}
            disabled={isDisabled}
            onPress={() => setVisible(true)}
          >
            <View pointerEvents="none">
              <TextInput
                mode="outlined"
                label={label}
                value={display}
                editable={false}
                disabled={isDisabled}
                error={Boolean(error)}
                right={<TextInput.Icon icon="menu-down" />}
                style={outlinedFieldStyle(theme)}
                contentStyle={outlinedFieldContentStyle}
              />
            </View>
          </Pressable>
        }
      >
        {options.map((option) => (
          <Menu.Item
            key={option}
            onPress={() => {
              onChange(option);
              setVisible(false);
              onBlur?.();
            }}
            title={option}
            leadingIcon={option === value ? "check" : undefined}
          />
        ))}
      </Menu>
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

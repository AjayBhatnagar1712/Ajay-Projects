import { View } from "react-native";
import { HelperText, RadioButton, Text } from "react-native-paper";

type Option = {
  value: string;
  label: string;
};

type Props = {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  isDisabled?: boolean;
  error?: string;
};

export function RadioOptionGroup({
  label,
  value,
  options,
  onChange,
  isDisabled = false,
  error,
}: Props) {
  return (
    <View>
      <Text variant="labelLarge">{label}</Text>
      <RadioButton.Group value={value} onValueChange={onChange}>
        {options.map((option) => (
          <RadioButton.Item
            key={option.value}
            value={option.value}
            label={option.label}
            disabled={isDisabled}
            position="leading"
            style={{ paddingHorizontal: 0 }}
            labelStyle={{ textAlign: "left" }}
          />
        ))}
      </RadioButton.Group>
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

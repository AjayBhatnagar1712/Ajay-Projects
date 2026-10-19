import { Pressable, View } from "react-native";
import { HelperText, Icon, Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import {
  QUANTITY_STEPPER_BUTTON,
  QUANTITY_STEPPER_PILL_HEIGHT,
  QUANTITY_STEPPER_PILL_INSET,
} from "@/lib/ui/quantityStepperChrome";
import {
  canDecrementQuantity,
  MIN_STEPPER_VALUE,
  stepQuantity,
} from "@/lib/ui/stepQuantity";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  isDisabled?: boolean;
  error?: string;
};

type StepperCircleProps = {
  icon: "minus" | "plus";
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
};

/**
 * Labeled +/− count control. Minus is disabled (greyed) at 1 — never 0.
 * Full-width pill (same radius rule as RecordsSearchField / Button: height/2)
 * with circular primary buttons and the count centered between them.
 */
export function QuantityStepper({
  label,
  value,
  onChange,
  isDisabled = false,
  error,
}: Props) {
  const theme = useAppTheme();
  const minusDisabled = isDisabled || !canDecrementQuantity(value);
  const displayValue = Number.isInteger(value) ? value : MIN_STEPPER_VALUE;

  return (
    <View style={{ width: "100%", gap: 8 }}>
      <Text
        variant="labelLarge"
        style={{
          color: theme.colors.headingText,
          fontFamily: fontFamilies.robotoMedium,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          width: "100%",
          height: QUANTITY_STEPPER_PILL_HEIGHT,
          paddingHorizontal: QUANTITY_STEPPER_PILL_INSET,
          backgroundColor: theme.colors.surfaceVariant,
          borderRadius: QUANTITY_STEPPER_PILL_HEIGHT / 2,
        }}
        accessibilityLabel={`${label}: ${displayValue}`}
      >
        <StepperCircle
          icon="minus"
          accessibilityLabel={`Decrease ${label}`}
          disabled={minusDisabled}
          onPress={() => onChange(stepQuantity(value, -1))}
        />
        <Text
          variant="titleMedium"
          style={{
            flex: 1,
            textAlign: "center",
            color: theme.colors.onSurface,
            fontFamily: fontFamilies.robotoMedium,
          }}
          accessibilityLiveRegion="polite"
        >
          {displayValue}
        </Text>
        <StepperCircle
          icon="plus"
          accessibilityLabel={`Increase ${label}`}
          disabled={isDisabled}
          onPress={() => onChange(stepQuantity(value, 1))}
        />
      </View>
      {error ? (
        <HelperText type="error" visible accessibilityLiveRegion="polite">
          {error}
        </HelperText>
      ) : null}
    </View>
  );
}

function StepperCircle({
  icon,
  accessibilityLabel,
  disabled,
  onPress,
}: StepperCircleProps) {
  const theme = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: QUANTITY_STEPPER_BUTTON,
        height: QUANTITY_STEPPER_BUTTON,
        borderRadius: QUANTITY_STEPPER_BUTTON / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: disabled
          ? theme.colors.outlineVariant
          : theme.colors.primary,
      }}
    >
      <Icon
        source={icon}
        size={20}
        color={
          disabled ? theme.colors.onSurfaceVariant : theme.colors.onPrimary
        }
      />
    </Pressable>
  );
}

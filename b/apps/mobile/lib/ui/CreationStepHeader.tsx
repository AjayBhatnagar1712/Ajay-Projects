import { View } from "react-native";
import { Text } from "react-native-paper";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";

export const CREATION_STEP_TOTAL = 5;

type Props = {
  /** 1-based step index (1…totalSteps). */
  step: number;
  totalSteps?: number;
  /**
   * When false, hides the trailing "N% Complete" label (broker onboarding).
   * Create-agreement keeps the percent by default.
   */
  showPercentComplete?: boolean;
};

/**
 * Shared step chrome: thin progress track + "Step N of M".
 * Used by create-agreement and broker onboarding.
 * Final step fill/label use success green (Agreement details + onboarding step 4).
 */
export function CreationStepHeader({
  step,
  totalSteps = CREATION_STEP_TOTAL,
  showPercentComplete = true,
}: Props) {
  const theme = useAppTheme();
  const clamped = Math.min(Math.max(step, 1), totalSteps);
  const percent = Math.round((clamped / totalSteps) * 100);
  const isFinal = clamped === totalSteps;
  const accent = isFinal ? theme.colors.success : theme.colors.primary;

  return (
    <View style={{ width: "100%", gap: 8 }}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: percent,
          text: `${percent} percent complete`,
        }}
        style={{
          width: "100%",
          height: 4,
          borderRadius: 100,
          overflow: "hidden",
          backgroundColor: theme.colors.outlineVariant,
          flexDirection: "row",
        }}
      >
        <View
          style={{
            width: `${percent}%`,
            height: 4,
            backgroundColor: accent,
          }}
        />
      </View>
      <View
        style={{
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: showPercentComplete ? "space-between" : "flex-end",
          paddingTop: 4,
        }}
      >
        {showPercentComplete ? (
          <Text
            variant="labelMedium"
            style={{
              color: accent,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            {`Step ${clamped} of ${totalSteps}`}
          </Text>
        ) : null}
        {showPercentComplete ? (
          <Text
            variant="labelSmall"
            style={{
              color: theme.colors.onSurfaceVariant,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            {`${percent}% Complete`}
          </Text>
        ) : (
          <Text
            variant="labelMedium"
            style={{
              color: accent,
              fontFamily: fontFamilies.robotoMedium,
            }}
          >
            {`Step ${clamped} of ${totalSteps}`}
          </Text>
        )}
      </View>
    </View>
  );
}

type TitleBlockProps = {
  title: string;
  /** Omit or pass empty to show heading only. */
  description?: string;
};

/**
 * Step heading + optional description.
 * Create-agreement screens that need Back use StackScreenHeader (same control
 * as Phone Entry) above or instead of this for the title row.
 */
export function CreationStepTitle({ title, description }: TitleBlockProps) {
  const theme = useAppTheme();
  const body = description?.trim() ?? "";

  return (
    <View style={{ width: "100%", gap: 4 }}>
      <Text
        variant="headlineSmall"
        style={{
          color: theme.colors.headingText,
          fontFamily: fontFamilies.generalSansSemibold,
        }}
      >
        {title}
      </Text>
      {body.length > 0 ? (
        <Text
          variant="bodyMedium"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontFamily: fontFamilies.robotoRegular,
          }}
        >
          {body}
        </Text>
      ) : null}
    </View>
  );
}

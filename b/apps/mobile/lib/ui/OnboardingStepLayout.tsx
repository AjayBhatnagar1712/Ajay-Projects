import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "react-native-paper";
import {
  CreationStepHeader,
  CreationStepTitle,
} from "@/lib/ui/CreationStepHeader";
import { CreationStepLayout } from "@/lib/ui/CreationStepLayout";
import { quietElevation } from "@/lib/ui/elevation";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Button } from "@/lib/ui/Button";

type Props = {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextTitle?: string;
  isSubmitting?: boolean;
  nextDisabled?: boolean;
};

/**
 * Broker onboarding chrome: progress (reuses CreationStepHeader), back,
 * title, scroll body, pinned Next (+ optional Back text).
 */
export function OnboardingStepLayout({
  step,
  title,
  description,
  children,
  onBack,
  onNext,
  nextTitle = "Next",
  isSubmitting = false,
  nextDisabled = false,
}: Props) {
  const theme = useAppTheme();
  const isFinal = step >= 4;

  return (
    <CreationStepLayout
      footer={
        <View
          style={{
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          {onBack ? (
            <Button
              title="Back"
              variant="tertiary"
              onPress={onBack}
              isDisabled={isSubmitting}
              isFullWidth={false}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Button
              title={nextTitle}
              onPress={onNext}
              isDisabled={isSubmitting || nextDisabled}
              isLoading={isSubmitting}
              buttonColor={isFinal ? theme.colors.success : undefined}
              textColor={isFinal ? theme.colors.onSuccess : undefined}
            />
          </View>
        </View>
      }
    >
      <CreationStepHeader step={step} totalSteps={4} showPercentComplete={false} />

      {onBack ? (
        <Pressable
          onPress={onBack}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          style={[
            quietElevation,
            {
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              opacity: isSubmitting ? 0.5 : 1,
              alignSelf: "flex-start",
            },
          ]}
        >
          <Icon
            source="chevron-left"
            size={24}
            color={theme.colors.headingText}
          />
        </Pressable>
      ) : null}

      <CreationStepTitle title={title} description={description ?? ""} />

      {children}
    </CreationStepLayout>
  );
}

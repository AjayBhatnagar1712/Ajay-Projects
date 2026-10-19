import type { ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  View,
  type ScrollView,
  type ScrollViewProps,
} from "react-native";
import { Text } from "react-native-paper";
import { AutosaveStatusLabel } from "@/lib/agreements/AutosaveStatusLabel";
import type {
  CreateAgreementEditOrigin,
  CreateAgreementEntry,
} from "@/lib/agreements/createAgreementNav";
import type { AutosaveStatus } from "@/lib/agreements/useAgreementStepAutosave";
import { useCancelAgreementDraft } from "@/lib/agreements/useCancelAgreementDraft";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Button } from "@/lib/ui/Button";
import { CreationStepHeader } from "@/lib/ui/CreationStepHeader";
import { CreationStepLayout } from "@/lib/ui/CreationStepLayout";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";

type Props = {
  step: number;
  title: string;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextTitle?: string;
  /** Persisted draft id — omit before first Property save / in preview stubs. */
  agreementId?: string;
  entry?: CreateAgreementEntry;
  /** Preview or Review-screen → Edit draft. Cancel saves/discards instead of deleting. */
  editOrigin?: CreateAgreementEditOrigin;
  /** Flush pending autosave (Preview Cancel → Save / Discard). */
  flushAutosave?: () => Promise<void>;
  isSubmitting?: boolean;
  nextDisabled?: boolean;
  /** When false, hides header Cancel. Default true. */
  showCancel?: boolean;
  /**
   * Override Cancel (e.g. preview no-op). Default: live `useCancelAgreementDraft`.
   */
  onCancel?: () => void;
  /** True while a custom `onCancel` is in flight (preview ignores). */
  isCancelling?: boolean;
  /** Called before destructive cancel so forms can drop pending autosave timers. */
  onBeforeCancel?: () => void;
  autosaveStatus?: AutosaveStatus;
  /** Alerts / banners pinned above the Back+Next row (e.g. parties validation). */
  footerBanner?: ReactNode;
  scrollRef?: Ref<ScrollView>;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
};

function CancelHeaderButton({
  onPress,
  isDisabled,
  isLoading,
}: {
  onPress: () => void;
  isDisabled: boolean;
  isLoading: boolean;
}) {
  const theme = useAppTheme();
  const blocked = isDisabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cancel agreement"
      accessibilityState={{ disabled: blocked, busy: isLoading }}
      disabled={blocked}
      onPress={onPress}
      hitSlop={4}
      style={{
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 4,
        alignItems: "center",
        justifyContent: "center",
        opacity: blocked && !isLoading ? 0.5 : 1,
      }}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.colors.error} size="small" />
      ) : (
        <Text
          variant="labelLarge"
          style={{
            color: theme.colors.error,
            fontFamily: fontFamilies.robotoMedium,
          }}
        >
          Cancel
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Create-agreement chrome shared by Property / Parties / Inventory / Terms
 * (and the preview route): progress + header Cancel, footer Back | Next.
 *
 * Cancel deletes the draft via `useCancelAgreementDraft` unless this session
 * is a snapshot Edit draft (`editOrigin`) or `onCancel` is passed.
 * Autosave status sits above the CTA row so the footer can match
 * onboarding's Back-left / Next-right layout.
 */
export function CreateAgreementStepLayout({
  step,
  title,
  children,
  onBack,
  onNext,
  nextTitle = "Next",
  agreementId,
  entry = "home",
  editOrigin,
  flushAutosave,
  isSubmitting = false,
  nextDisabled = false,
  showCancel = true,
  onCancel,
  isCancelling: isCancellingOverride,
  onBeforeCancel,
  autosaveStatus = "idle",
  footerBanner,
  scrollRef,
  contentContainerStyle,
}: Props) {
  const liveCancel = useCancelAgreementDraft({
    agreementId,
    entry,
    editOrigin,
    flushAutosave,
  });
  const isCancelling = onCancel
    ? Boolean(isCancellingOverride)
    : liveCancel.isCancelling;
  const busy = isSubmitting || isCancelling;

  function handleCancel(): void {
    if (onCancel) {
      onCancel();
      return;
    }
    if (!editOrigin) {
      onBeforeCancel?.();
    }
    liveCancel.requestCancel();
  }

  return (
    <CreationStepLayout
      scrollRef={scrollRef}
      contentContainerStyle={contentContainerStyle}
      footer={
        <View style={{ width: "100%", gap: 12, alignItems: "center" }}>
          {footerBanner}
          <AutosaveStatusLabel status={autosaveStatus} />
          <View
            style={{
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Button
              title="Back"
              variant="tertiary"
              onPress={onBack}
              isDisabled={busy}
              isFullWidth={false}
            />
            <View style={{ flex: 1 }}>
              <Button
                title={nextTitle}
                onPress={onNext}
                isDisabled={busy || nextDisabled}
                isLoading={isSubmitting}
              />
            </View>
          </View>
        </View>
      }
    >
      <CreationStepHeader step={step} />
      <StackScreenHeader
        title={title}
        onBack={onBack}
        backDisabled={busy}
        right={
          showCancel ? (
            <CancelHeaderButton
              onPress={handleCancel}
              isDisabled={isSubmitting}
              isLoading={isCancelling}
            />
          ) : null
        }
      />
      {children}
    </CreationStepLayout>
  );
}

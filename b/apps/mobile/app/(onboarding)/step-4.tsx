import { BrokerOnboardingStep4Schema } from "@workspace/api-schemas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { getBrokerProfile, patchBrokerProfile } from "@/lib/api/client";
import { markOnboardingCompleteLocal } from "@/lib/auth/onboardingCompleteLocal";
import { previousOnboardingStepHref } from "@/lib/broker/previousOnboardingStepHref";
import {
  onboardingStepDescription,
  useIsProfileEdit,
  useIsOnboardingResume,
} from "@/lib/broker/onboardingResume";
import { profileHasStep4Data } from "@/lib/broker/step4FormValues";
import {
  deriveIndianState,
  formatIndianState,
  normalizeIndianState,
  regionWithIndianState,
  regionWithoutIndianState,
} from "@/lib/broker/workLocationState";
import {
  selectionsFromProfile,
  selectionsReadyToSubmit,
  selectionsToProfileFields,
  type WorkLocationSelection,
} from "@/lib/broker/workLocationSelections";
import { goBackOrFallback } from "@/lib/navigation/goBackOrFallback";
import { replaceRoot } from "@/lib/navigation/replaceRoot";
import { Alert } from "@/lib/ui/Alert";
import {
  submitPrimaryFromKeyboard,
  type FieldFocusHandle,
} from "@/lib/ui/fieldFocusChain";
import { LocationPlaceField } from "@/lib/ui/LocationPlaceField";
import { OnboardingStepLayout } from "@/lib/ui/OnboardingStepLayout";
import { PincodeChipField } from "@/lib/ui/PincodeChipField";
import { TextField } from "@/lib/ui/TextField";

/** Step 4 — Your work location. Progress bar is green via CreationStepHeader. */
export default function OnboardingStep4() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isResumed = useIsOnboardingResume();
  const isEditing = useIsProfileEdit();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selections, setSelections] = useState<WorkLocationSelection[]>([]);
  const [stateName, setStateName] = useState("");
  const [pincodes, setPincodes] = useState<string[]>([]);
  const didHydrateRef = useRef(false);
  const searchRef = useRef<FieldFocusHandle>(null);
  const stateRef = useRef<FieldFocusHandle>(null);
  const pincodeRef = useRef<FieldFocusHandle>(null);

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
  } = useQuery({
    queryKey: ["broker-profile"],
    queryFn: getBrokerProfile,
  });

  useEffect(() => {
    if (didHydrateRef.current) return;
    if (isProfileLoading) return;
    if (isProfileError) {
      didHydrateRef.current = true;
      return;
    }
    if (profileHasStep4Data(profile ?? null) && profile) {
      setSelections(
        selectionsFromProfile({
          region: regionWithoutIndianState(profile.region),
          pincodes: profile.pincodes,
        }),
      );
      const savedState = deriveIndianState(profile.region);
      setStateName(savedState ? formatIndianState(savedState) : "");
      setPincodes(profile.pincodes);
    }
    didHydrateRef.current = true;
  }, [profile, isProfileLoading, isProfileError]);

  async function onNext(): Promise<void> {
    setSubmitError(null);
    setFieldError(null);
    setStateError(null);
    setPincodeError(null);

    if (!selectionsReadyToSubmit(selections)) {
      setFieldError("Add at least one work location.");
      return;
    }

    const normalizedState = normalizeIndianState(stateName);
    if (!normalizedState) {
      setStateError("Enter a valid Indian state.");
      return;
    }

    if (pincodes.length === 0) {
      setPincodeError("Add at least one 6-digit pincode.");
      return;
    }

    const locationFields = selectionsToProfileFields(selections);
    const fields = {
      ...locationFields,
      region: regionWithIndianState(locationFields.region, normalizedState),
      pincodes,
    };
    const parsed = BrokerOnboardingStep4Schema.safeParse({
      ...fields,
      stepCompleted: 4,
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message;
      setFieldError(first ?? "Check your locations and try again.");
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await patchBrokerProfile({
        region: parsed.data.region,
        pincodes: parsed.data.pincodes,
        stepCompleted: 4,
      });
      queryClient.setQueryData(["broker-profile"], saved);
      await markOnboardingCompleteLocal();
      replaceRoot(router, isEditing ? "/(tabs)/profile" : "/(tabs)/home");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not save step 4");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <OnboardingStepLayout
      step={4}
      title="Your work location"
      description={onboardingStepDescription(
        "Add the areas, state and pincodes where you operate.",
        isResumed,
      )}
      nextTitle="Finish"
      onBack={() =>
        goBackOrFallback(router, () =>
          router.replace(previousOnboardingStepHref(4, isEditing)),
        )
      }
      onNext={() => void onNext()}
      isSubmitting={isSubmitting}
    >
      <LocationPlaceField
        searchFieldRef={searchRef}
        selections={selections}
        onChange={(next) => {
          setSelections(next);
          setPincodes((current) => [
            ...new Set([
              ...current,
              ...next.flatMap((selection) =>
                selection.pincode ? [selection.pincode] : [],
              ),
            ]),
          ]);
          setFieldError(null);
        }}
        isDisabled={isSubmitting}
        error={fieldError ?? undefined}
        returnKeyType="next"
        onSubmitEditing={() => stateRef.current?.focus()}
      />

      <TextField
        ref={stateRef}
        label="State"
        value={stateName}
        onChangeText={(value) => {
          setStateName(value);
          setStateError(null);
        }}
        isDisabled={isSubmitting}
        error={stateError ?? undefined}
        autoCapitalize="words"
        necessityIndicator="required"
        returnKeyType="next"
        onSubmitEditing={() => pincodeRef.current?.focus()}
      />

      <PincodeChipField
        ref={pincodeRef}
        pincodes={pincodes}
        onChange={(next) => {
          setPincodes(next);
          setPincodeError(null);
        }}
        isDisabled={isSubmitting}
        error={pincodeError ?? undefined}
        returnKeyType="done"
        onSubmitEditing={submitPrimaryFromKeyboard(() => void onNext())}
      />

      {submitError ? <Alert description={submitError} /> : null}
    </OnboardingStepLayout>
  );
}

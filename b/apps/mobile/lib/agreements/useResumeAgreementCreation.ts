import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { getLeaseAgreement } from "@/lib/api/client";
import {
  type CreateAgreementEntry,
  pushCreateAgreementStep,
} from "@/lib/agreements/createAgreementNav";
import { inferAgreementCreationStep } from "@/lib/agreements/flow";

type ResumeState = {
  /** Agreement id currently being resumed, or null. */
  resumeId: string | null;
  resumeError: string | null;
  resumeAgreement: (
    agreementId: string,
    entry: CreateAgreementEntry,
  ) => Promise<void>;
  clearResumeError: () => void;
};

/**
 * Same resume path as Agreements tab "Continue": fetch detail, infer step, navigate.
 * `entry` is required so Back can return to Home vs Agreements after stepping out.
 */
export function useResumeAgreementCreation(): ResumeState {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);

  async function resumeAgreement(
    agreementId: string,
    entry: CreateAgreementEntry,
  ): Promise<void> {
    setResumeId(agreementId);
    setResumeError(null);
    try {
      const detail = await queryClient.fetchQuery({
        queryKey: ["lease-agreement", agreementId],
        queryFn: () => getLeaseAgreement(agreementId),
      });
      const step = inferAgreementCreationStep(detail);
      pushCreateAgreementStep(router, step, entry, agreementId);
    } catch (error) {
      setResumeError(
        error instanceof Error ? error.message : "Could not resume agreement",
      );
    } finally {
      setResumeId(null);
    }
  }

  return {
    resumeId,
    resumeError,
    resumeAgreement,
    clearResumeError: () => setResumeError(null),
  };
}

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { PropertyForm } from "@/lib/agreements/PropertyForm";
import {
  parseCreateAgreementEditOrigin,
  parseCreateAgreementEntry,
} from "@/lib/agreements/createAgreementNav";
import { getLeaseAgreement } from "@/lib/api/client";
import { CreationStepLayout } from "@/lib/ui/CreationStepLayout";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { Spinner } from "@/lib/ui/Spinner";
import { Text } from "@/lib/ui/Typography";
import { Stack } from "@/lib/ui/Stack";

function routeId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function PropertyStep() {
  const params = useLocalSearchParams<{
    agreementId?: string | string[];
    entry?: string | string[];
    fromPreview?: string | string[];
    fromReview?: string | string[];
  }>();
  const agreementId = routeId(params.agreementId);
  const entry = parseCreateAgreementEntry(params.entry);
  const editOrigin = parseCreateAgreementEditOrigin(params);
  const detailQuery = useQuery({
    queryKey: ["lease-agreement", agreementId],
    queryFn: () => getLeaseAgreement(agreementId ?? ""),
    enabled: agreementId !== undefined,
  });

  if (agreementId && detailQuery.isLoading) {
    return (
      <CreationStepLayout>
        <Stack gap="spacing.4">
          <Spinner accessibilityLabel="Loading saved property" />
          <Text color="subtle">Loading saved property…</Text>
        </Stack>
      </CreationStepLayout>
    );
  }
  if (agreementId && detailQuery.error) {
    return (
      <CreationStepLayout>
        <ErrorRecoveryActions onRetry={() => void detailQuery.refetch()} />
      </CreationStepLayout>
    );
  }

  return (
    <PropertyForm
      agreementId={agreementId}
      detail={detailQuery.data}
      entry={entry}
      editOrigin={editOrigin}
    />
  );
}

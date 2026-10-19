import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { InventoryForm } from "@/lib/agreements/InventoryForm";
import {
  createAgreementParams,
  parseCreateAgreementEditOrigin,
  parseCreateAgreementEntry,
} from "@/lib/agreements/createAgreementNav";
import { getLeaseAgreement } from "@/lib/api/client";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { CreationStepLayout } from "@/lib/ui/CreationStepLayout";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { Spinner } from "@/lib/ui/Spinner";
import { Text } from "@/lib/ui/Typography";
import { Stack } from "@/lib/ui/Stack";

function routeId(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function InventoryStep() {
  const router = useRouter();
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

  if (!agreementId) {
    return (
      <CreationStepLayout>
        <Alert description="No agreement was selected." />
        <Button
          title="Start again"
          onPress={() =>
            router.replace({
              pathname: "/(create-agreement)/property",
              params: createAgreementParams(entry, undefined, editOrigin),
            })
          }
        />
      </CreationStepLayout>
    );
  }
  if (detailQuery.isLoading) {
    return (
      <CreationStepLayout>
        <Stack gap="spacing.4">
          <Spinner accessibilityLabel="Loading saved fixtures & fittings" />
          <Text color="subtle">Loading saved fixtures & fittings…</Text>
        </Stack>
      </CreationStepLayout>
    );
  }
  if (detailQuery.error || !detailQuery.data) {
    return (
      <CreationStepLayout>
        <ErrorRecoveryActions onRetry={() => void detailQuery.refetch()} />
      </CreationStepLayout>
    );
  }

  return (
    <InventoryForm
      agreementId={agreementId}
      detail={detailQuery.data}
      entry={entry}
      editOrigin={editOrigin}
    />
  );
}

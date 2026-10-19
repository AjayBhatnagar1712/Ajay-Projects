import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getLeaseAgreement,
  listLeaseAgreements,
  type LeaseAgreementDetail,
} from "@/lib/api/client";
import {
  agreementsNeedingPartyDetail,
  buildDerivedAlerts,
  buildPayoutVerifiedAlert,
  type DerivedAlert,
} from "@/lib/notifications/derivedAlerts";
import { hasSeenPayoutVerifiedAlert } from "@/lib/payments/payoutVerifiedAlertSeen";
import { useBrokerPayoutStatus } from "@/lib/payments/useBrokerPayoutStatus";

type DerivedAlertsState = {
  alerts: DerivedAlert[];
  /** True only while we have nothing useful to show yet. */
  isLoading: boolean;
  /** Background refresh — panels should stay open with cached alerts. */
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Shared derived-alerts query. Home, header badge, and Notifications panel all
 * call this hook — React Query dedupes by key so opening Notifications after
 * Home has loaded is cache-hit (no spinner / no second network round-trip).
 */
export function useDerivedAlerts(): DerivedAlertsState {
  const listQuery = useQuery({
    queryKey: ["lease-agreements"],
    queryFn: listLeaseAgreements,
  });
  const payout = useBrokerPayoutStatus();
  const payoutAlertSeenQuery = useQuery({
    queryKey: ["payout-verified-alert-seen"],
    queryFn: hasSeenPayoutVerifiedAlert,
  });

  const agreements = listQuery.data?.leaseAgreements ?? [];
  const needingDetail = useMemo(
    () => agreementsNeedingPartyDetail(agreements),
    [agreements],
  );

  const detailQueries = useQueries({
    queries: needingDetail.map((agreement) => ({
      queryKey: ["lease-agreement", agreement.id] as const,
      queryFn: () => getLeaseAgreement(agreement.id),
      enabled: listQuery.isSuccess,
    })),
  });

  const detailsById = useMemo(() => {
    const map = new Map<string, LeaseAgreementDetail>();
    needingDetail.forEach((agreement, index) => {
      const detail = detailQueries[index]?.data;
      if (detail) map.set(agreement.id, detail);
    });
    return map;
  }, [needingDetail, detailQueries]);

  const alerts = useMemo(() => {
    const agreementAlerts = buildDerivedAlerts(agreements, detailsById);
    const showPayout =
      payout.view === "active" && payoutAlertSeenQuery.data === false;
    if (!showPayout) return agreementAlerts;
    return [buildPayoutVerifiedAlert(), ...agreementAlerts];
  }, [agreements, detailsById, payout.view, payoutAlertSeenQuery.data]);

  const detailsPending = detailQueries.some((q) => q.isPending && !q.data);
  const detailsFetching = detailQueries.some((q) => q.isFetching);
  const detailError = detailQueries.find((q) => q.error)?.error;

  const hasList = listQuery.isSuccess;
  // Don't block UI once list is in — provisional alerts are better than a laggy panel.
  const isLoading = (!hasList && listQuery.isPending) || (hasList && detailsPending && alerts.length === 0);

  return {
    alerts,
    isLoading,
    isFetching: listQuery.isFetching || detailsFetching || payout.isLoading,
    error:
      listQuery.error instanceof Error
        ? listQuery.error
        : detailError instanceof Error
          ? detailError
          : listQuery.error
            ? new Error(String(listQuery.error))
            : detailError
              ? new Error(String(detailError))
              : null,
    refetch: () => {
      void listQuery.refetch();
      for (const q of detailQueries) void q.refetch();
      payout.refetch();
      void payoutAlertSeenQuery.refetch();
    },
  };
}

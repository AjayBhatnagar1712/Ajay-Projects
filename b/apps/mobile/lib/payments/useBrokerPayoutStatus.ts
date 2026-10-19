import { useQuery } from "@tanstack/react-query";
import {
  getPaymentOnboardStatus,
  type PaymentOnboardStatus,
} from "@/lib/api/client";
import { loadStoredSession } from "@/lib/auth/secureSession";
import {
  derivePayoutSetupView,
  type PayoutSetupView,
} from "@/lib/payments/payoutStatus";

const PAYOUT_STATUS_KEY = "payment-onboard-status" as const;

export function brokerPayoutStatusQueryKey(phone: string) {
  return [PAYOUT_STATUS_KEY, phone, "broker"] as const;
}

export function useBrokerPayoutStatus(): {
  phone: string;
  status: PaymentOnboardStatus | undefined;
  view: PayoutSetupView;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const sessionQuery = useQuery({
    queryKey: ["stored-session"],
    queryFn: loadStoredSession,
  });
  const phone = sessionQuery.data?.phone?.replace(/\D/g, "").slice(-10) ?? "";

  const statusQuery = useQuery({
    queryKey: brokerPayoutStatusQueryKey(phone),
    queryFn: () => getPaymentOnboardStatus(phone, "broker"),
    enabled: phone.length === 10,
  });

  const error =
    sessionQuery.error instanceof Error
      ? sessionQuery.error
      : statusQuery.error instanceof Error
        ? statusQuery.error
        : sessionQuery.error
          ? new Error(String(sessionQuery.error))
          : statusQuery.error
            ? new Error(String(statusQuery.error))
            : null;

  return {
    phone,
    status: statusQuery.data,
    view: derivePayoutSetupView(statusQuery.data),
    isLoading:
      sessionQuery.isLoading || (phone.length === 10 && statusQuery.isLoading),
    error,
    refetch: () => {
      void sessionQuery.refetch();
      void statusQuery.refetch();
    },
  };
}

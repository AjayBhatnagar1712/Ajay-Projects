import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo } from "react";
import { View } from "react-native";
import { Text as PaperText } from "react-native-paper";
import { listBrokerPayments } from "@/lib/api/client";
import { useDerivedAlerts } from "@/lib/notifications/useDerivedAlerts";
import { PayoutSetupBanner } from "@/lib/payments/PayoutSetupBanner";
import {
  formatConsultancyRupees,
  formatPaymentReceivedDate,
  groupBrokerPaymentsByMonth,
  paymentPropertyLabel,
  thisMonthTotalPaise,
} from "@/lib/payments/groupBrokerPayments";
import { markPayoutVerifiedAlertSeen } from "@/lib/payments/payoutVerifiedAlertSeen";
import { useBrokerPayoutStatus } from "@/lib/payments/useBrokerPayoutStatus";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAppTheme } from "@/lib/theme/useAppTheme";
import { Alert } from "@/lib/ui/Alert";
import { Button } from "@/lib/ui/Button";
import { ErrorRecoveryActions } from "@/lib/ui/ErrorRecoveryActions";
import { RecordCard, RecordDetailRow } from "@/lib/ui/RecordCard";
import { ShellHeader } from "@/lib/ui/ShellHeader";
import { Spinner } from "@/lib/ui/Spinner";
import { StateScreen } from "@/lib/ui/StateScreen";
import { Heading, Text } from "@/lib/ui/Typography";
import { TintedSectionCard } from "@/lib/ui/TintedSectionCard";
import { Stack } from "@/lib/ui/Stack";

const TAB_EDGES = ["top", "left", "right"] as const;

export default function PaymentsTab() {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const { alerts, isLoading: alertsLoading, refetch: refetchAlerts } =
    useDerivedAlerts();
  const payout = useBrokerPayoutStatus();
  const phone = payout.phone;

  const paymentsQuery = useQuery({
    queryKey: ["broker-payments", phone],
    queryFn: () => listBrokerPayments(phone),
    enabled: phone.length === 10 && payout.view === "active",
  });

  useFocusEffect(
    useCallback(() => {
      if (payout.view !== "active") return;
      void markPayoutVerifiedAlertSeen().then(() => {
        void queryClient.invalidateQueries({
          queryKey: ["payout-verified-alert-seen"],
        });
      });
    }, [payout.view, queryClient]),
  );

  const payments = paymentsQuery.data?.payments ?? [];
  const monthGroups = useMemo(
    () => groupBrokerPaymentsByMonth(payments),
    [payments],
  );
  const monthTotal = useMemo(
    () => thisMonthTotalPaise(payments),
    [payments],
  );

  const showSetup = !payout.isLoading && payout.view !== "active";

  return (
    <ScreenSafeArea
      edges={TAB_EDGES}
      onRefresh={() => {
        payout.refetch();
        void paymentsQuery.refetch();
        refetchAlerts();
      }}
    >
      <ShellHeader alerts={alerts} alertsLoading={alertsLoading} />

      <Heading size="large">Payments</Heading>

      {payout.isLoading ? (
        <View style={{ paddingVertical: 32, alignItems: "center" }}>
          <Spinner accessibilityLabel="Loading payments" />
          <Text color="subtle">Loading…</Text>
        </View>
      ) : null}

      {payout.error ? (
        <ErrorRecoveryActions onRetry={() => payout.refetch()} />
      ) : showSetup ? (
        <PayoutSetupBanner />
      ) : null}

      {payout.view === "active" && !payout.error ? (
        <Stack gap="spacing.4">
          <TintedSectionCard>
            <PaperText
              variant="labelMedium"
              style={{
                color: theme.colors.primary,
                fontFamily: fontFamilies.robotoMedium,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              This month
            </PaperText>
            <PaperText
              variant="headlineSmall"
              style={{
                color: theme.colors.headingText,
                fontFamily: fontFamilies.generalSansSemibold,
              }}
            >
              {formatConsultancyRupees(monthTotal)}
            </PaperText>
            <Text color="subtle">Consultancy fees received this month</Text>
          </TintedSectionCard>

          {paymentsQuery.isLoading ? (
            <Spinner accessibilityLabel="Loading consultancy fees" />
          ) : null}

          {paymentsQuery.error ? (
            <Stack gap="spacing.3">
              <Alert
                description={
                  paymentsQuery.error instanceof Error
                    ? paymentsQuery.error.message
                    : "Could not load consultancy fees"
                }
              />
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => {
                  void paymentsQuery.refetch();
                }}
              />
            </Stack>
          ) : null}

          {!paymentsQuery.isLoading &&
          !paymentsQuery.error &&
          monthGroups.length === 0 ? (
            <StateScreen
              density="inline"
              icon="cash-off"
              title="No consultancy fees yet"
              description="Payments you receive will appear here, grouped by month."
            />
          ) : null}

          {monthGroups.map((group) => (
            <View key={group.monthKey} style={{ width: "100%", gap: 12 }}>
              <PaperText
                variant="titleSmall"
                style={{
                  color: theme.colors.headingText,
                  fontFamily: fontFamilies.generalSansSemibold,
                }}
              >
                {group.title}
              </PaperText>
              {group.payments.map((payment) => {
                const received = formatPaymentReceivedDate(
                  payment.paidAt ?? payment.createdAt,
                );
                const amount =
                  typeof payment.amountPaise === "string"
                    ? Number(payment.amountPaise)
                    : payment.amountPaise;
                const label = paymentPropertyLabel(payment);
                return (
                  <RecordCard
                    key={payment.id}
                    title={label}
                    accessibilityLabel={`${label}. ${formatConsultancyRupees(amount)}. ${received}`}
                  >
                    <View style={{ width: "100%", gap: 6 }}>
                      <RecordDetailRow
                        label="Amount"
                        value={formatConsultancyRupees(amount)}
                      />
                      {received ? (
                        <RecordDetailRow label="Received" value={received} />
                      ) : null}
                    </View>
                  </RecordCard>
                );
              })}
            </View>
          ))}
        </Stack>
      ) : null}
    </ScreenSafeArea>
  );
}

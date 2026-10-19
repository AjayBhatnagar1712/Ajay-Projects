import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  createLeaseBrokerageOrder,
  createLeaseRentOrder,
  getPortalAgreement,
} from "@/lib/api/client";
import {
  formatAgreementDate,
  formatAgreementMoney,
} from "@/lib/agreements/flow";
import { loadStoredSession } from "@/lib/auth/secureSession";
import {
  consultancyPaymentStatusLabel,
  rentStateLabel,
} from "@/lib/notifications/portalDerivedAlerts";
import { ScreenSafeArea } from "@/lib/ScreenSafeArea";
import { Alert } from "@/lib/ui/Alert";
import { AgreementStatusChip } from "@/lib/ui/AgreementStatusChip";
import { Button } from "@/lib/ui/Button";
import { RecordCard, RecordDetailRow } from "@/lib/ui/RecordCard";
import { Spinner } from "@/lib/ui/Spinner";
import { Stack } from "@/lib/ui/Stack";
import { StackScreenHeader } from "@/lib/ui/StackScreenHeader";
import { StateScreen } from "@/lib/ui/StateScreen";
import { Heading, Text } from "@/lib/ui/Typography";

const PORTAL_HOME = "/(portal)/home" as Href;

function propertyTitle(address: string | null): string {
  const trimmed = address?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Untitled property";
}

export default function PortalAgreementDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ agreementId?: string }>();
  const agreementId =
    typeof params.agreementId === "string" ? params.agreementId : "";

  const [actionError, setActionError] = useState<string | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["stored-session"],
    queryFn: loadStoredSession,
  });
  const phone = sessionQuery.data?.phone?.replace(/\D/g, "").slice(-10) ?? "";

  const detailQuery = useQuery({
    queryKey: ["portal-agreement", agreementId],
    queryFn: () => getPortalAgreement(agreementId),
    enabled: agreementId.length > 0,
  });

  const rentMutation = useMutation({
    mutationFn: createLeaseRentOrder,
  });
  const brokerageMutation = useMutation({
    mutationFn: createLeaseBrokerageOrder,
  });

  const detail = detailQuery.data;
  const isLoading = detailQuery.isLoading || sessionQuery.isLoading;
  const loadError =
    detailQuery.error instanceof Error
      ? detailQuery.error.message
      : detailQuery.error
        ? "Could not load agreement"
        : null;

  const startCheckout = (order: {
    orderId: string;
    keyId: string;
    amountPaise: number;
    description?: string;
  }) => {
    router.push({
      pathname: "/(portal)/checkout",
      params: {
        agreementId,
        orderId: order.orderId,
        keyId: order.keyId,
        amountPaise: String(order.amountPaise),
        description: order.description ?? "Payment",
      },
    } as Href);
  };

  const onPayRent = async (rentPeriod: string) => {
    setActionError(null);
    if (!detail) {
      setActionError("Agreement details are still loading. Try again in a moment.");
      return;
    }
    if (phone.length !== 10) {
      setActionError("Your login session is incomplete. Sign out, sign in again, and retry the payment.");
      return;
    }
    try {
      const order = await rentMutation.mutateAsync({
        phone,
        agreementId: detail.id,
        rentPeriod,
      });
      startCheckout(order);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not start rent payment",
      );
    }
  };

  const onPayBrokerage = async () => {
    setActionError(null);
    if (!detail) {
      setActionError("Agreement details are still loading. Try again in a moment.");
      return;
    }
    if (phone.length !== 10) {
      setActionError("Your login session is incomplete. Sign out, sign in again, and retry the payment.");
      return;
    }
    try {
      const order = await brokerageMutation.mutateAsync({
        phone,
        agreementId: detail.id,
      });
      startCheckout(order);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Could not start consultancy fee payment",
      );
    }
  };

  if (isLoading && !detail) {
    return (
      <ScreenSafeArea scroll={false}>
        <StackScreenHeader title="Agreement" fallbackHref={PORTAL_HOME} />
        <Spinner accessibilityLabel="Loading agreement" />
        <Text color="subtle">Loading…</Text>
      </ScreenSafeArea>
    );
  }

  if (loadError || !detail) {
    return (
      <ScreenSafeArea>
        <StackScreenHeader title="Agreement" fallbackHref={PORTAL_HOME} />
        <StateScreen
          icon="alert-circle-outline"
          title="Couldn't load agreement"
          description={loadError ?? "Agreement not found"}
          tone="error"
          density="inline"
          primaryAction={{
            title: "Try again",
            onPress: () => {
              void detailQuery.refetch();
              void queryClient.invalidateQueries({
                queryKey: ["portal-agreements"],
              });
            },
          }}
        />
      </ScreenSafeArea>
    );
  }

  const isOwner = detail.partyRole === "owner";
  const isTenant = detail.partyRole === "tenant";
  const isSigned = detail.status === "signed";
  const payoutActivated = detail.ownerPayout?.activated === true;
  const showPayoutSetup = isOwner && !payoutActivated;
  const showBrokeragePay =
    isTenant &&
    isSigned &&
    detail.brokerageFeePaise != null &&
    detail.brokerageFeePaise > 0 &&
    !detail.brokeragePaid;
  const rentInvoices = detail.rentInvoices ?? [];
  const busy = rentMutation.isPending || brokerageMutation.isPending;

  return (
    <ScreenSafeArea
      onRefresh={() => {
        void detailQuery.refetch();
      }}
    >
      <StackScreenHeader
        title={propertyTitle(detail.propertyAddress)}
        fallbackHref={PORTAL_HOME}
      />

      <Stack gap="spacing.4">
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text size="small" color="subtle">
            {isOwner ? "Owner" : isTenant ? "Tenant" : detail.partyRole}
          </Text>
          <AgreementStatusChip status={detail.status} />
        </View>

        <RecordCard title="Key terms">
          <View style={{ width: "100%", gap: 6 }}>
            <RecordDetailRow
              label="Monthly rent"
              value={formatAgreementMoney(detail.monthlyRentPaise)}
            />
            <RecordDetailRow
              label="Deposit"
              value={formatAgreementMoney(detail.securityDepositPaise)}
            />
            {detail.brokerageFeePaise != null &&
            detail.brokerageFeePaise > 0 ? (
              <>
                <RecordDetailRow
                  label="Consultancy fee"
                  value={formatAgreementMoney(detail.brokerageFeePaise)}
                />
                {isTenant && isSigned ? (
                  <RecordDetailRow
                    label="Consultancy fee status"
                    value={consultancyPaymentStatusLabel(
                      detail.brokeragePaymentStatus,
                    )}
                  />
                ) : null}
              </>
            ) : null}
            <RecordDetailRow
              label="Start"
              value={formatAgreementDate(detail.effectiveDate)}
            />
            <RecordDetailRow
              label="End"
              value={formatAgreementDate(detail.endDate)}
            />
            <RecordDetailRow
              label="Monthly payment deadline"
              value="5th of each month"
            />
            {isSigned ? (
              <RecordDetailRow
                label="Rent status"
                value={rentStateLabel(detail.rentPaymentState)}
              />
            ) : null}
          </View>
        </RecordCard>

        {actionError ? <Alert description={actionError} /> : null}

        {showPayoutSetup ? (
          <Stack gap="spacing.3">
            <Heading size="small">Payouts</Heading>
            <Text color="subtle">
              Set up your bank account to receive rent settlements.
            </Text>
            <Button
              title="Set up payout"
              onPress={() =>
                router.push({
                  pathname: "/(portal)/payout-setup",
                  params: { agreementId },
                } as Href)
              }
            />
          </Stack>
        ) : null}

        {showBrokeragePay ? (
          <Stack gap="spacing.3">
            <Heading size="small">Payments</Heading>
            {showBrokeragePay ? (
              <Button
                title="Pay consultancy fee"
                onPress={() => void onPayBrokerage()}
                isLoading={brokerageMutation.isPending}
                isDisabled={busy}
              />
            ) : null}
          </Stack>
        ) : null}
        {rentInvoices.length > 0 ? (
          <Stack gap="spacing.3">
            <Heading size="small">Rent bills</Heading>
            {rentInvoices.map((invoice) => (
              <RecordCard
                key={invoice.rentPeriod}
                title={`${formatAgreementDate(invoice.coverageStart)} - ${formatAgreementDate(invoice.coverageEnd)}`}
              >
                <View style={{ width: "100%", gap: 10 }}>
                  <RecordDetailRow
                    label="Amount"
                    value={formatAgreementMoney(invoice.amountPaise)}
                  />
                  <RecordDetailRow
                    label="Days covered"
                    value={`${invoice.billedDays} of ${invoice.daysInMonth}`}
                  />
                  <RecordDetailRow
                    label="Pay by"
                    value={formatAgreementDate(invoice.dueDate)}
                  />
                  <RecordDetailRow
                    label="Status"
                    value={rentStateLabel(invoice.state)}
                  />
                  {isTenant &&
                  isSigned &&
                  (invoice.state === "due_soon" || invoice.state === "late") ? (
                    <Button
                      title={`Pay ${formatAgreementMoney(invoice.amountPaise)}`}
                      onPress={() => void onPayRent(invoice.rentPeriod)}
                      isLoading={
                        rentMutation.isPending &&
                        rentMutation.variables?.rentPeriod ===
                          invoice.rentPeriod
                      }
                      isDisabled={busy}
                    />
                  ) : null}
                </View>
              </RecordCard>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </ScreenSafeArea>
  );
}

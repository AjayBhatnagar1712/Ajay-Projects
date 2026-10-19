import { queueCloudSync } from "./cloudSync";
import { getActiveSession, getItem, setItem } from "./storageKeys";

export const BROKER_ONBOARD_ANALYTICS_KEY = "broker_tenant_onboard_analytics";

export type BrokerOnboardAnalyticsEvent =
  | "link_generated"
  | "link_copied"
  | "whatsapp_shared"
  | "email_shared"
  | "telegram_shared"
  | "sms_shared"
  | "native_share_used";

export interface BrokerOnboardAnalyticsRecord {
  id: string;
  event: BrokerOnboardAnalyticsEvent;
  brokerPhone: string;
  tenantPhone?: string;
  token?: string;
  createdAt: number;
}

function readRecords(): BrokerOnboardAnalyticsRecord[] {
  try {
    const raw = getItem(BROKER_ONBOARD_ANALYTICS_KEY);
    return raw ? (JSON.parse(raw) as BrokerOnboardAnalyticsRecord[]) : [];
  } catch {
    return [];
  }
}

function persistRecords(list: BrokerOnboardAnalyticsRecord[]): void {
  const payload = JSON.stringify(list);
  setItem(BROKER_ONBOARD_ANALYTICS_KEY, payload);
  queueCloudSync(BROKER_ONBOARD_ANALYTICS_KEY, payload);
}

export function trackBrokerOnboardEvent(
  event: BrokerOnboardAnalyticsEvent,
  meta?: { tenantPhone?: string; token?: string },
): void {
  const session = getActiveSession();
  if (!session || session.role !== "broker") return;

  const record: BrokerOnboardAnalyticsRecord = {
    id: `boa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    event,
    brokerPhone: session.phone,
    tenantPhone: meta?.tenantPhone,
    token: meta?.token,
    createdAt: Date.now(),
  };

  const list = readRecords();
  list.unshift(record);
  persistRecords(list.slice(0, 200));
}

export function getBrokerOnboardAnalytics(): BrokerOnboardAnalyticsRecord[] {
  return readRecords();
}

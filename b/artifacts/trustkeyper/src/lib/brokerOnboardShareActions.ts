import { trackBrokerOnboardEvent } from "./brokerOnboardAnalytics";

export interface BrokerOnboardShareContext {
  tenantPhone: string;
  token: string;
}

export interface BrokerOnboardLinkPayload {
  tenantName: string;
  tenantPhone: string;
  link: string;
  token: string;
}

export async function copyBrokerOnboardLink(
  link: string,
  context: BrokerOnboardShareContext,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(link);
    trackBrokerOnboardEvent("link_copied", context);
    return true;
  } catch {
    return false;
  }
}

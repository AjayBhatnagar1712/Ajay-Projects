import { getMarketingApiBase } from "@/lib/marketingAuthLookup";
import type { MarketingAuthRole } from "@/lib/marketingAuthRoles";

export interface MarketingSignupProfileData {
  name: string;
  phone: string;
  firm?: string;
  propertyCount?: string;
  email?: string;
  bankHolderName?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIFSC?: string;
  upiId?: string;
  upiQrFileName?: string;
  propertyIntent?: string;
}

function emptyProfileFields(): Record<string, string> {
  return {
    firm: "",
    email: "",
    bankHolderName: "",
    bankName: "",
    bankAccountNumber: "",
    bankIFSC: "",
    upiId: "",
    upiQrFileName: "",
    propertyIntent: "",
  };
}

export function buildOwnerSignupProfile(
  phone: string,
  name: string,
  propertyCount: string,
): MarketingSignupProfileData {
  return {
    ...emptyProfileFields(),
    name: name.trim(),
    phone,
    propertyCount,
  };
}

export function buildBrokerSignupProfile(
  phone: string,
  name: string,
  firm: string,
): MarketingSignupProfileData {
  return {
    ...emptyProfileFields(),
    name: name.trim(),
    phone,
    firm: firm.trim(),
  };
}

/** Maps profile PUT failures to actionable user-facing errors (exported for tests). */
export async function describeMarketingSignupProfileFailure(res: Response): Promise<string> {
  let serverError: string | undefined;
  try {
    const json = (await res.json()) as { error?: unknown };
    if (typeof json.error === "string" && json.error.trim()) {
      serverError = json.error.trim();
    }
  } catch {
    /* non-JSON body */
  }

  if (res.status === 401) {
    return "Your verification session expired. Please verify your phone again.";
  }
  if (res.status === 403) {
    return "This phone number does not match your verification session. Please start again.";
  }
  if (res.status === 400) {
    return serverError ?? "Invalid signup details. Please check and try again.";
  }
  if (res.status >= 500) {
    return "Server error while creating your account. Please try again shortly.";
  }
  return serverError
    ? `Could not create your account (${res.status}): ${serverError}`
    : `Could not create your account (${res.status}). Please try again.`;
}

export async function pushMarketingSignupProfile({
  phone,
  role,
  profile,
  accessToken,
}: {
  phone: string;
  role: MarketingAuthRole;
  profile: MarketingSignupProfileData;
  accessToken: string | null | undefined;
}): Promise<{ ok: boolean; error?: string }> {
  if (!accessToken) {
    return { ok: false, error: "Missing verification session. Please log in again." };
  }

  try {
    const res = await fetch(
      `${getMarketingApiBase()}/sync/accounts/${phone}/${role}/profile`,
      {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ value: JSON.stringify(profile) }),
      },
    );
    if (!res.ok) {
      return { ok: false, error: await describeMarketingSignupProfileFailure(res) };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "Could not reach the account service. Check your connection, or this site may be blocked from the API (CORS).",
    };
  }
}

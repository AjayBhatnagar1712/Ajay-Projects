import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { MarketingAuthContinueButton } from "@/components/auth/MarketingAuthContinueButton";
import { MarketingExistingAccountShell } from "@/components/auth/MarketingExistingAccountShell";
import { MarketingAuthWelcomeBack } from "@/components/auth/MarketingAuthWelcomeBack";
import { fetchMarketingAccountSummariesForPhone } from "@/lib/marketingAuthLookup";
import {
  buildMarketingExistingAccountUrl,
} from "@/lib/marketingAppRoutes";
import {
  clearMarketingAuthHandoff,
  readMarketingAuthHandoff,
} from "@/lib/marketingAuthHandoff";
import {
  buildMarketingSignupRoleFormPath,
  buildMarketingSignupRolePath,
} from "@/lib/marketingSignupPaths";
import {
  marketingRolesMissingFrom,
  type MarketingAccountSummary,
  type MarketingAuthRole,
} from "@/lib/marketingAuthRoles";
import { normalizeMarketingPhoneDigits } from "@/lib/marketingAuthOtp";

export interface ExistingAccountPageProps {
  mock?: boolean;
}

const MOCK_ACCOUNTS: MarketingAccountSummary[] = [
  { role: "owner", displayName: "Meena" },
];

const MOCK_MISSING_ROLES: MarketingAuthRole[] = ["tenant", "broker"];

const MOCK_PHONE = "6369856040";

export function ExistingAccountPage({ mock = false }: ExistingAccountPageProps) {
  const search = useSearch();
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(!mock);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MarketingAccountSummary[]>(mock ? MOCK_ACCOUNTS : []);
  const [missingRoles, setMissingRoles] = useState<MarketingAuthRole[]>(
    mock ? MOCK_MISSING_ROLES : [],
  );
  const [selectedSignupRole, setSelectedSignupRole] = useState<MarketingAuthRole | null>(null);
  const [continuingRole, setContinuingRole] = useState<MarketingAuthRole | null>(null);
  const [signupContinuing, setSignupContinuing] = useState(false);

  const query = useMemo(() => new URLSearchParams(search), [search]);

  const phoneDigits = mock
    ? MOCK_PHONE
    : normalizeMarketingPhoneDigits(query.get("phone") ?? readMarketingAuthHandoff()?.phone ?? "");

  const rememberMe = mock
    ? false
    : query.get("remember") === "1" || readMarketingAuthHandoff()?.rememberMe === true;

  useEffect(() => {
    if (mock) return;

    const handoff = readMarketingAuthHandoff();
    if (!handoff && phoneDigits.length !== 10) {
      setError("Your session expired. Please log in again.");
      setLoading(false);
      return;
    }

    if (phoneDigits.length !== 10) {
      setError("Invalid phone number.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const summaries = await fetchMarketingAccountSummariesForPhone(phoneDigits);
        if (cancelled) return;
        if (summaries.length === 0) {
          clearMarketingAuthHandoff();
          setLocation(buildMarketingSignupRolePath());
          return;
        }

        const roles = summaries.map((account) => account.role);
        setAccounts(summaries);
        setMissingRoles(marketingRolesMissingFrom(roles));
        setSelectedSignupRole(null);
      } catch {
        if (!cancelled) setError("Could not load your accounts. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mock, phoneDigits, rememberMe, setLocation]);

  const finishExistingAccount = (role: MarketingAuthRole) => {
    const handoff = readMarketingAuthHandoff();
    setContinuingRole(role);
    window.location.assign(
      buildMarketingExistingAccountUrl({
        phone: phoneDigits,
        role,
        rememberMe,
        accessToken: handoff?.accessToken,
        refreshToken: handoff?.refreshToken,
      }),
    );
    clearMarketingAuthHandoff();
  };

  const finishSignupRole = () => {
    if (!selectedSignupRole) return;
    setSignupContinuing(true);
    setLocation(buildMarketingSignupRoleFormPath(selectedSignupRole));
  };

  if (loading) {
    return (
      <MarketingExistingAccountShell ariaLabel="Your accounts">
        <p className="text-center text-sm text-marketing-muted">Loading your accounts...</p>
      </MarketingExistingAccountShell>
    );
  }

  if (error) {
    return (
      <MarketingExistingAccountShell ariaLabel="Your accounts">
        <p className="text-center text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="mt-6 w-full rounded-lg bg-marketing-blue py-3.5 text-base font-semibold text-white"
        >
          Back to home
        </button>
      </MarketingExistingAccountShell>
    );
  }

  return (
    <MarketingExistingAccountShell ariaLabel="Welcome back">
      <MarketingAuthWelcomeBack
        accounts={accounts}
        missingRoles={missingRoles}
        selectedSignupRole={selectedSignupRole}
        continuingRole={continuingRole}
        onExistingAccountClick={finishExistingAccount}
        onSignupRoleSelect={setSelectedSignupRole}
      />

      {missingRoles.length > 0 ? (
        <MarketingAuthContinueButton
          disabled={!selectedSignupRole}
          loading={signupContinuing}
          onClick={finishSignupRole}
        />
      ) : null}
    </MarketingExistingAccountShell>
  );
}

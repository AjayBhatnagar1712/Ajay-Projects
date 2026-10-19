import React, { useCallback, useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SharedPropertyLandingBackdrop } from "@/components/tenant/SharedPropertyLandingBackdrop";
import {
  TenantBrokerOnboardModal,
  type TenantOnboardModalPhase,
} from "@/components/tenant/TenantBrokerOnboardModal";
import { TenantDocumentManagementFlow } from "@/components/tenant/TenantDocumentManagementFlow";
import { TenantDocumentUploadFlow } from "@/components/tenant/TenantDocumentUploadFlow";
import {
  getActiveSession,
  loginSuccess,
  persistSessionToLocalStorage,
  profileExistsAsync,
  restoreRememberedSessionFromLocalStorage,
  setAuthPendingRole,
  signUpSuccess,
  rollbackFailedSignup,
} from "@/lib/auth";
import {
  fetchDocumentUploadInvite,
  markDocumentUploadStarted,
  type DocumentUploadInvitePayload,
} from "@/lib/publicAgreementDocumentUpload";
import { sendPhoneOtp } from "@/lib/phoneOtp";
import { syncTenantDocumentUploadStatus } from "@/lib/tenantDocumentUploadStatus";
import {
  clearTenantDocumentUploadSession,
  getTenantDocumentUploadSession,
  hasRememberedTenantDocumentUploadSession,
  setTenantDocumentUploadSession,
  type TenantDocumentUploadSession,
} from "@/lib/tenantDocumentUploadSession";
import { finalizeTenantDashboardAccess } from "@/lib/tenantDocumentUploadRedirect";
import { getSupabaseAccessToken } from "@/lib/syncSession";
import { mergeTenantProfileFromInvitePayload } from "@/lib/tenantProfile";
import { saveTenantWorkspaceFromInvite } from "@/lib/tenantWorkspace";
import {
  documentsAlreadySubmittedForInvite,
  resolveReturningTenantAccess,
  shouldOpenDocumentManagement,
} from "@/lib/tenantReturningAccess";

type PagePhase = "loading" | "invalid" | "expired" | "modal" | "upload" | "management";

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function buildUploadSession(
  token: string,
  invite: DocumentUploadInvitePayload,
): TenantDocumentUploadSession {
  const digits = phoneLast10(invite.tenantPhone);
  return {
    token,
    name: invite.tenantName,
    phone: `+91${digits}`,
    requesterName: invite.requesterName,
    verifiedAt: Date.now(),
  };
}

export default function TenantDocumentUpload() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/upload/documents/:token");
  const token = params?.token ?? "";

  const [pagePhase, setPagePhase] = useState<PagePhase>("loading");
  const [modalPhase, setModalPhase] = useState<TenantOnboardModalPhase>("welcome");
  const [invite, setInvite] = useState<DocumentUploadInvitePayload | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [sendOtpError, setSendOtpError] = useState<string | null>(null);
  const [verifyOtpError, setVerifyOtpError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [session, setSession] = useState<TenantDocumentUploadSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [redirectToDashboardAfterAuth, setRedirectToDashboardAfterAuth] = useState(false);

  const redirectToTenantDashboard = useCallback(
    async (tenantPhone: string, remember = rememberMe) => {
      const digits = phoneLast10(tenantPhone);
      const accessToken = await getSupabaseAccessToken();
      const ok = await finalizeTenantDashboardAccess(
        digits,
        getActiveSession,
        loginSuccess,
        { remember, accessToken },
      );
      if (!ok) return;
      setLocation("/tenant/dashboard", { replace: true });
    },
    [rememberMe, setLocation],
  );

  const openWithSession = useCallback(
    (payload: DocumentUploadInvitePayload, nextSession: TenantDocumentUploadSession, phase: PagePhase) => {
      setInvite(payload);
      setSession(nextSession);
      setTenantDocumentUploadSession(nextSession);
      setPagePhase(phase);
    },
    [],
  );

  const bootstrap = useCallback(async () => {
    if (!token) {
      setPagePhase("invalid");
      setLoadError("Invalid document upload link");
      return;
    }

    setPagePhase("loading");
    const { payload, error, status } = await fetchDocumentUploadInvite(token);
    if (!payload) {
      if (status === 410) {
        setPagePhase("expired");
        setLoadError(error ?? "This document upload link has expired");
        return;
      }
      setPagePhase("invalid");
      setLoadError(error ?? "Invalid document upload link");
      return;
    }

    if (payload.status === "expired") {
      setPagePhase("expired");
      setLoadError("This document upload link has expired");
      return;
    }

    const alreadySubmitted = documentsAlreadySubmittedForInvite(payload);

    if (!alreadySubmitted) {
      mergeTenantProfileFromInvitePayload(payload);
    } else {
      saveTenantWorkspaceFromInvite(payload, {
        documentUploadStatus: "documents_submitted",
        documentUploadSubmittedAt: payload.submittedAt ?? Date.now(),
      });
    }

    const activeSession = getActiveSession();
    const rememberedSession = restoreRememberedSessionFromLocalStorage();
    const existingUploadSession = getTenantDocumentUploadSession(token);
    const tenantDigits = phoneLast10(payload.tenantPhone);
    const rememberedTenantMatch =
      rememberedSession?.role === "tenant" && phoneLast10(rememberedSession.phone) === tenantDigits;

    const sessionAfterRestore = getActiveSession();

    const access = resolveReturningTenantAccess({
      inviteStatus: payload.status,
      tenantPhone: payload.tenantPhone,
      hasActiveTenantSession: sessionAfterRestore?.role === "tenant",
      activeTenantPhone: sessionAfterRestore?.phone,
      hasUploadSession: Boolean(existingUploadSession),
      hasTenantAccount: payload.hasTenantAccount,
      hasRememberedTenantSession: rememberedTenantMatch,
      rememberedTenantPhone: rememberedSession?.phone,
    });

    if (access.kind === "blocked") {
      setPagePhase(access.reason === "expired" ? "expired" : "invalid");
      setLoadError(
        access.reason === "expired"
          ? "This document upload link has expired"
          : "Invalid document upload link",
      );
      return;
    }

    if (access.kind === "immediate") {
      if (access.reason === "active_tenant_session" || rememberedTenantMatch) {
        await finalizeTenantDashboardAccess(tenantDigits, getActiveSession, loginSuccess, {
          remember: rememberedTenantMatch,
        });
      }

      if (alreadySubmitted) {
        await redirectToTenantDashboard(payload.tenantPhone);
        return;
      }

      const nextSession = existingUploadSession ?? buildUploadSession(token, payload);
      openWithSession(payload, nextSession, "upload");
      void markDocumentUploadStarted(token);
      syncTenantDocumentUploadStatus(payload.tenantPhone, "documents_in_progress", { token });
      return;
    }

    setInvite(payload);
    setName(payload.tenantName);
    setPhone(phoneLast10(payload.tenantPhone));
    setRedirectToDashboardAfterAuth(alreadySubmitted);
    setModalPhase("welcome");
    setPagePhase("modal");
  }, [openWithSession, redirectToTenantDashboard, token]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const handleSendOtp = async (): Promise<boolean> => {
    setSendOtpError(null);
    setSendingOtp(true);
    try {
      const digits = phone.replace(/\D/g, "").slice(-10);
      const err = await sendPhoneOtp(digits);
      if (err) {
        setSendOtpError(err);
        return false;
      }
      setModalPhase("otp");
      return true;
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpVerified = async (success: boolean, accessToken?: string | null) => {
    if (!success || !invite) {
      setVerifyOtpError("Invalid or expired OTP. Please try again.");
      return;
    }

    const digits = phone.replace(/\D/g, "").slice(-10);
    setVerifyOtpError(null);

    try {
      const hasAccount = await profileExistsAsync(digits, "tenant");
      if (!hasAccount) {
        await signUpSuccess(
          digits,
          "tenant",
          { name: name.trim(), phone: digits },
          accessToken ?? undefined,
        );
      } else {
        const loggedIn = await loginSuccess(digits, "tenant", accessToken);
        if (!loggedIn) {
          setVerifyOtpError("Could not sign in. Please try again.");
          return;
        }
      }

      setAuthPendingRole("tenant");

      if (rememberMe) {
        persistSessionToLocalStorage(digits, "tenant");
      }

      const nextSession: TenantDocumentUploadSession = {
        token,
        name: name.trim(),
        phone: `+91${digits}`,
        requesterName: invite.requesterName,
        verifiedAt: Date.now(),
      };
      setTenantDocumentUploadSession(nextSession, { remember: rememberMe });
      setSession(nextSession);

      saveTenantWorkspaceFromInvite(invite);
      if (!redirectToDashboardAfterAuth) {
        mergeTenantProfileFromInvitePayload(invite);
      }

      if (redirectToDashboardAfterAuth || documentsAlreadySubmittedForInvite(invite)) {
        saveTenantWorkspaceFromInvite(invite, {
          documentUploadStatus: "documents_submitted",
          documentUploadSubmittedAt: invite.submittedAt ?? Date.now(),
        });
        await redirectToTenantDashboard(invite.tenantPhone);
        return;
      }

      void markDocumentUploadStarted(token);
      syncTenantDocumentUploadStatus(invite.tenantPhone, "documents_in_progress", { token });
      openDocumentFlowAfterVerification(nextSession, invite);
    } catch (err) {
      await rollbackFailedSignup(digits, "tenant");
      setVerifyOtpError(
        err instanceof Error ? err.message : "Could not verify your account. Please try again.",
      );
    }
  };

  const openDocumentFlowAfterVerification = (
    nextSession: TenantDocumentUploadSession,
    payload: DocumentUploadInvitePayload,
  ) => {
    setSession(nextSession);
    setPagePhase(shouldOpenDocumentManagement(payload.status) ? "management" : "upload");
  };

  const handleAccountSuccessDone = () => {
    if (!invite) return;
    const nextSession = session ?? buildUploadSession(token, invite);
    openDocumentFlowAfterVerification(nextSession, invite);
  };

  const handleFlowDone = async () => {
    if (invite) {
      syncTenantDocumentUploadStatus(invite.tenantPhone, "documents_submitted", {
        token,
        submittedAt: Date.now(),
      });
      saveTenantWorkspaceFromInvite(invite, {
        documentUploadStatus: "documents_submitted",
        documentUploadSubmittedAt: Date.now(),
      });
      const accessToken = await getSupabaseAccessToken();
      const ok = await finalizeTenantDashboardAccess(invite.tenantPhone, getActiveSession, loginSuccess, {
        remember: rememberMe,
        accessToken,
      });
      if (!ok) {
        setVerifyOtpError(
          "Could not sign in to your tenant dashboard. Log in at TrustKeyper with your mobile number.",
        );
        return;
      }
    }
    clearTenantDocumentUploadSession(token, {
      preserveRemembered: hasRememberedTenantDocumentUploadSession(token),
    });
    setLocation("/tenant/dashboard", { replace: true });
  };

  if (pagePhase === "loading") {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6">
        <Loader2 size={32} className="animate-spin text-primary mb-4" />
        <p className="text-sm text-gray-500">Loading your document request…</p>
      </div>
    );
  }

  if (pagePhase === "management" && session && invite) {
    return <TenantDocumentManagementFlow invite={invite} session={session} />;
  }

  if (pagePhase === "upload" && session && invite) {
    return <TenantDocumentUploadFlow invite={invite} session={session} onDone={handleFlowDone} />;
  }

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 overflow-hidden blur-sm pointer-events-none select-none">
        <SharedPropertyLandingBackdrop />
      </div>

      {pagePhase === "modal" && invite ? (
        <TenantBrokerOnboardModal
          phase={modalPhase}
          flowContext="document_upload"
          requesterName={invite.requesterName}
          propertyLabel={invite.propertyLabel}
          name={name}
          phone={phone}
          onNameChange={setName}
          onPhoneChange={setPhone}
          onOtpVerified={(ok, accessToken) => void handleOtpVerified(ok, accessToken)}
          onAccountSuccessDone={handleAccountSuccessDone}
          sendOtpError={sendOtpError}
          verifyOtpError={verifyOtpError}
          sendingOtp={sendingOtp}
          onSendOtp={handleSendOtp}
          showRememberMe
          rememberMe={rememberMe}
          onRememberMeChange={setRememberMe}
        />
      ) : null}

      {pagePhase === "invalid" || pagePhase === "expired" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {pagePhase === "expired" ? "Link expired" : "Invalid link"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">{loadError ?? "This document upload link is not valid."}</p>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setAuthPendingRole("tenant");
                setLocation("/login");
              }}
            >
              Sign In
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

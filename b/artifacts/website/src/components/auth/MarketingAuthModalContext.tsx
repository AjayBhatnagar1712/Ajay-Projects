import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MarketingAuthModal } from "@/components/auth/MarketingAuthModal";

export interface MarketingAuthVerifiedPayload {
  phone: string;
  rememberMe: boolean;
  otp: string;
}

interface MarketingAuthModalContextValue {
  openAuthModal: () => void;
  closeAuthModal: () => void;
  isAuthModalOpen: boolean;
}

const MarketingAuthModalContext = createContext<MarketingAuthModalContextValue | null>(null);

function readAuthHashMode(): "login" | "signup" | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "login" || hash === "signup") return hash;
  return null;
}

export interface MarketingAuthModalProviderProps {
  children: React.ReactNode;
  onAuthVerified?: (payload: MarketingAuthVerifiedPayload) => void;
}

export function MarketingAuthModalProvider({
  children,
  onAuthVerified,
}: MarketingAuthModalProviderProps) {
  const [open, setOpen] = useState(false);

  const openAuthModal = useCallback(() => setOpen(true), []);
  const closeAuthModal = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const mode = readAuthHashMode();
    if (!mode) return;
    openAuthModal();
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [openAuthModal]);

  const value = useMemo(
    () => ({
      openAuthModal,
      closeAuthModal,
      isAuthModalOpen: open,
    }),
    [closeAuthModal, open, openAuthModal],
  );

  return (
    <MarketingAuthModalContext.Provider value={value}>
      {children}
      <MarketingAuthModal
        open={open}
        onOpenChange={setOpen}
        onAuthVerified={onAuthVerified}
      />
    </MarketingAuthModalContext.Provider>
  );
}

export function useMarketingAuthModal(): MarketingAuthModalContextValue {
  const context = useContext(MarketingAuthModalContext);
  if (!context) {
    throw new Error("useMarketingAuthModal must be used within MarketingAuthModalProvider");
  }
  return context;
}

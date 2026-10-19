import { useEffect, useState } from "react";
import { Briefcase, Check, Home, IndianRupee, User, Users } from "lucide-react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  dashboardRouteFor,
  getAccountsForPhoneAsync,
  getActiveSession,
  getProfileDisplayName,
  isAuthEntryRole,
  roleDisplayLabel,
  switchRoleAsync,
  type Role,
} from "@/lib/auth";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleIcon(role: Role) {
  switch (role) {
    case "owner":
      return User;
    case "broker":
      return IndianRupee;
    case "tenant":
      return Home;
    case "manager":
      return Briefcase;
    default:
      return Users;
  }
}

interface AccountSwitcherProps {
  /** Called after switching (e.g. close mobile sidebar). */
  onAfterSwitch?: () => void;
  className?: string;
}

export function AccountSwitcher({ onAfterSwitch, className }: AccountSwitcherProps) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<Role | null>(null);
  const session = getActiveSession();
  const [accounts, setAccounts] = useState<Role[]>([]);

  useEffect(() => {
    if (!session) {
      setAccounts([]);
      return;
    }
    void getAccountsForPhoneAsync(session.phone).then((roles) =>
      setAccounts(roles.filter((r) => isAuthEntryRole(r))),
    );
  }, [session?.phone, session?.role]);

  if (!session || accounts.length <= 1) return null;

  const handleSwitch = async (role: Role) => {
    if (role === session.role || switching) {
      if (role === session.role) setOpen(false);
      return;
    }
    setSwitching(role);
    await new Promise((resolve) => setTimeout(resolve, 180));
    await switchRoleAsync(role);
    setSwitching(null);
    setOpen(false);
    onAfterSwitch?.();
    setLocation(dashboardRouteFor(role));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 w-full text-left"
        }
      >
        <Users size={18} className="text-gray-500 shrink-0" />
        Switch account
      </button>

      <Dialog open={open} onOpenChange={(next) => !switching && setOpen(next)}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden rounded-2xl border border-gray-200 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)]">
          <DialogHeader className="relative px-6 pt-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-center text-lg font-semibold text-gray-900 pr-8">
              Account switch
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-3 max-h-[min(60vh,360px)] overflow-y-auto">
            {accounts.map((role) => {
              const name = getProfileDisplayName(session.phone, role);
              const active = role === session.role;
              const isLoading = switching === role;
              const RoleIcon = roleIcon(role);
              return (
                <button
                  key={role}
                  type="button"
                  disabled={Boolean(switching)}
                  onClick={() => void handleSwitch(role)}
                  className={`flex w-full items-center gap-3 p-4 text-left rounded-xl border transition-all duration-200 cursor-pointer ${
                    active
                      ? "border-primary bg-blue-50/60 shadow-sm ring-1 ring-primary/20"
                      : "border-gray-200 bg-white shadow-sm hover:border-primary/40 hover:shadow-md hover:bg-blue-50/30 active:scale-[0.99]"
                  } ${isLoading ? "opacity-70 pointer-events-none" : ""}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                      active ? "bg-primary text-white" : "bg-blue-50 text-primary"
                    }`}
                  >
                    <span className="text-sm font-semibold">{initialsFromName(name)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <RoleIcon size={12} className="shrink-0" />
                      {roleDisplayLabel(role)}
                    </p>
                  </div>
                  {active ? (
                    <Check size={20} className="text-primary shrink-0" strokeWidth={2.5} />
                  ) : isLoading ? (
                    <span className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <span className="text-xs font-medium text-primary shrink-0">Switch</span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

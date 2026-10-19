import { ArrowRight, FileSignature, FileText, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import type { TenantNotificationContent, TenantNotificationKind } from "@/lib/tenantWorkspace";
import { cn } from "@/lib/utils";

const NOTIFICATION_ICONS: Partial<Record<TenantNotificationKind, LucideIcon>> = {
  esign_document_upload: FileSignature,
};

export interface TenantStatusNotificationCardProps {
  notification: TenantNotificationContent;
  loading?: boolean;
}

export function TenantStatusNotificationCard({ notification, loading }: TenantStatusNotificationCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#D9EAF8] bg-[#F3F9FE] p-4 h-full animate-pulse">
        <div className="rounded-xl bg-white p-5 h-full min-h-[160px]">
          <div className="h-10 w-10 rounded-xl bg-gray-100 mb-4" />
          <div className="h-5 bg-gray-100 rounded w-1/2 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-full" />
        </div>
      </div>
    );
  }

  const Icon = NOTIFICATION_ICONS[notification.kind] ?? FileText;
  const isHighlight =
    notification.kind === "documents_under_review" ||
    notification.kind === "agreement_being_prepared" ||
    notification.kind === "agreement_ready" ||
    notification.kind === "esign_document_upload";

  return (
    <div className="rounded-2xl border border-[#D9EAF8] bg-[#F3F9FE] p-4 h-full">
      <div
        className={cn(
          "rounded-xl bg-white p-5 sm:p-6 h-full flex flex-col shadow-sm",
          isHighlight && "border border-primary/10",
        )}
      >
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center mb-4 shrink-0",
            isHighlight ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-500",
          )}
        >
          <Icon size={20} />
        </div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{notification.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed flex-1">{notification.description}</p>
        {notification.actionHref && notification.actionLabel ? (
          <Button
            type="button"
            className="mt-4 h-9 px-4 rounded-lg text-sm font-semibold w-fit gap-1.5"
            asChild
          >
            <Link href={notification.actionHref}>
              {notification.actionLabel}
              <ArrowRight size={16} aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

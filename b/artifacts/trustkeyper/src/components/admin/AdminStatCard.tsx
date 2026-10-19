/**
 * Reusable stat card for admin dashboard metrics
 */
import React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_PRIMARY } from "@/lib/adminAuth";
import { cn } from "@/lib/utils";

/** Direction indicator for optional trend display. */
export type AdminStatTrend = "up" | "down" | "neutral";

/**
 * Props for {@link AdminStatCard}.
 */
export interface AdminStatCardProps {
  /** Metric label shown below the value. */
  title: string;
  /** Primary metric value (pre-formatted string or number). */
  value: string | number;
  /** Optional supporting text under the title. */
  subtitle?: string;
  /** Optional Lucide icon displayed beside the value. */
  icon?: LucideIcon;
  /** Optional trend indicator for contextual metrics. */
  trend?: AdminStatTrend;
  /** When true, renders a skeleton placeholder instead of data. */
  loading?: boolean;
  /** Optional extra class names for the card root. */
  className?: string;
}

const trendConfig: Record<
  AdminStatTrend,
  { icon: LucideIcon; className: string; label: string }
> = {
  up: { icon: ArrowUp, className: "text-emerald-600", label: "Up" },
  down: { icon: ArrowDown, className: "text-red-600", label: "Down" },
  neutral: { icon: Minus, className: "text-gray-500", label: "Neutral" },
};

/**
 * Displays a single dashboard metric inside a shadcn Card.
 */
export function AdminStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading = false,
  className,
}: AdminStatCardProps) {
  if (loading) {
    return (
      <Card className={cn("border-gray-200 bg-white shadow-sm", className)}>
        <CardContent className="p-6">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="mb-2 h-9 w-16" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend ? trendConfig[trend].icon : null;

  return (
    <Card className={cn("border-gray-200 bg-white shadow-sm", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          {Icon ? (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${ADMIN_PRIMARY}14`, color: ADMIN_PRIMARY }}
            >
              <Icon size={18} />
            </span>
          ) : null}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{value}</p>
          {trend && TrendIcon ? (
            <span
              className={cn("mb-1 flex items-center gap-0.5 text-xs font-medium", trendConfig[trend].className)}
              aria-label={trendConfig[trend].label}
            >
              <TrendIcon size={14} />
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
      </CardContent>
    </Card>
  );
}

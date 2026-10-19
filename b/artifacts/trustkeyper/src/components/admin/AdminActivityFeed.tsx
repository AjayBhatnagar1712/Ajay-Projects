/**
 * Recent activity feed derived from latest user and property data
 */
import React, { useMemo } from "react";
import { Building2, UserPlus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminProperty, AdminUser } from "@/lib/adminApi";
import { timeAgo } from "@/lib/tenants";

interface AdminActivityFeedProps {
  /** User records used to derive signup / profile activity. */
  users?: AdminUser[];
  /** Property records used to derive listing activity. */
  properties?: AdminProperty[];
  /** When true, renders skeleton placeholders. */
  loading?: boolean;
}

interface ActivityItem {
  id: string;
  icon: LucideIcon;
  description: string;
  timestamp: number;
}

const MAX_ACTIVITIES = 10;

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Property owner";
    case "broker":
      return "Broker";
    case "tenant":
      return "Tenant";
    case "manager":
      return "Manager";
    default:
      return role;
  }
}

function buildActivities(users: AdminUser[], properties: AdminProperty[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const user of users) {
    const timestamp = Date.parse(user.updatedAt);
    if (Number.isNaN(timestamp)) continue;

    const displayName = user.name.trim() || `+91 ${user.phone}`;
    items.push({
      id: `user-${user.phone}-${user.role}`,
      icon: UserPlus,
      description: `${displayName} (${roleLabel(user.role)}) profile updated`,
      timestamp,
    });
  }

  for (const property of properties) {
    const timestamp = Date.parse(property.updatedAt);
    if (Number.isNaN(timestamp)) continue;

    const address = property.address.trim() || "Unnamed property";
    const status = property.status.trim() || "Unknown status";
    items.push({
      id: `property-${property.ownerPhone}-${address}-${timestamp}`,
      icon: Building2,
      description: `Property at ${address} — ${status}`,
      timestamp,
    });
  }

  return items
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_ACTIVITIES);
}

/**
 * Renders a chronological list of recent platform activity.
 */
export function AdminActivityFeed({ users = [], properties = [], loading = false }: AdminActivityFeedProps) {
  const activities = useMemo(
    () => buildActivities(users, properties),
    [users, properties],
  );

  if (loading) {
    return (
      <Card className="border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-900">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-gray-900">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <Empty className="border border-dashed border-gray-200 py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Building2 />
              </EmptyMedia>
              <EmptyTitle>No recent activity</EmptyTitle>
              <EmptyDescription>
                User signups and property updates will appear here as the platform grows.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activities.map((activity) => {
              const Icon = activity.icon;
              return (
                <li key={activity.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1B4F8A]/10 text-[#1B4F8A]">
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{timeAgo(activity.timestamp)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

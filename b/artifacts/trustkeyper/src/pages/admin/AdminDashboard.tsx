import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building2, IndianRupee, User, Users } from "lucide-react";
import { AdminActivityFeed } from "@/components/admin/AdminActivityFeed";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { Button } from "@/components/ui/button";
import { useAdminProperties, useAdminStats, useAdminUsers } from "@/hooks/useAdminData";

/**
 * Admin dashboard page — displays platform stats, recent activity,
 * and weekly growth metrics. Requires active admin session.
 */
export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const statsQuery = useAdminStats();
  const usersQuery = useAdminUsers();
  const propertiesQuery = useAdminProperties();

  const statsLoading = statsQuery.isLoading;
  const activityLoading = usersQuery.isLoading || propertiesQuery.isLoading;

  const handleRetry = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">Platform overview and recent activity</p>
        </div>

        {statsQuery.isError ? (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Could not load dashboard data. Please try again.</p>
              {statsQuery.error?.message ? (
                <p className="mt-1 text-sm text-red-700/80">{statsQuery.error.message}</p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-red-200 bg-white hover:bg-red-50"
                onClick={handleRetry}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            title="Total Users"
            value={statsQuery.data?.totalUsers ?? 0}
            subtitle="All registered profiles"
            icon={Users}
            loading={statsLoading}
          />
          <AdminStatCard
            title="Total Owners"
            value={statsQuery.data?.totalOwners ?? 0}
            subtitle="Property owner accounts"
            icon={User}
            loading={statsLoading}
          />
          <AdminStatCard
            title="Total Brokers"
            value={statsQuery.data?.totalBrokers ?? 0}
            subtitle="Broker accounts"
            icon={IndianRupee}
            loading={statsLoading}
          />
          <AdminStatCard
            title="Total Properties"
            value={statsQuery.data?.totalProperties ?? 0}
            subtitle="Listings across accounts"
            icon={Building2}
            loading={statsLoading}
          />
        </section>

        <section>
          <AdminActivityFeed
            users={usersQuery.data}
            properties={propertiesQuery.data}
            loading={activityLoading}
          />
        </section>

        <section>
          <AdminStatCard
            title="New this week"
            value={statsQuery.data?.newUsersThisWeek ?? 0}
            subtitle="Profiles created or updated in the last 7 days"
            trend={
              (statsQuery.data?.newUsersThisWeek ?? 0) > 0
                ? "up"
                : "neutral"
            }
            loading={statsLoading}
            className="max-w-sm"
          />
        </section>
      </div>
    </AdminLayout>
  );
}

/**
 * Admin users page — full list of all platform users
 */
import React from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminUserTable } from "@/components/admin/AdminUserTable";
import { Button } from "@/components/ui/button";
import { useAdminUsers } from "@/hooks/useAdminData";

/**
 * Admin portal page listing all registered platform users with search and filters.
 */
export default function AdminUsers() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useAdminUsers();

  const users = data ?? [];
  const totalCount = users.length;

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Users</h2>
            <p className="mt-1 text-sm text-gray-500">
              {isLoading
                ? "Loading user accounts…"
                : `${totalCount} registered ${totalCount === 1 ? "user" : "users"} on the platform`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 self-start"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={16} />
            Refresh
          </Button>
        </div>

        <AdminUserTable users={users} isLoading={isLoading} isError={isError} />
      </div>
    </AdminLayout>
  );
}

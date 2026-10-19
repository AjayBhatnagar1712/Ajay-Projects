/**
 * Admin properties page — full list of all platform properties
 */
import React from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPropertyTable } from "@/components/admin/AdminPropertyTable";
import { Button } from "@/components/ui/button";
import { useAdminProperties } from "@/hooks/useAdminData";

/**
 * Admin portal page listing all platform properties with search.
 */
export default function AdminProperties() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useAdminProperties();

  const properties = data ?? [];
  const totalCount = properties.length;

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "properties"] });
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Properties</h2>
            <p className="mt-1 text-sm text-gray-500">
              {isLoading
                ? "Loading properties…"
                : `${totalCount} ${totalCount === 1 ? "property" : "properties"} across all accounts`}
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

        <AdminPropertyTable
          properties={properties}
          isLoading={isLoading}
          isError={isError}
        />
      </div>
    </AdminLayout>
  );
}

/**
 * Admin agreements list — lease_agreements signing queue.
 */
import React from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminAgreementsTable } from "@/components/admin/AdminAgreementsTable";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { useAdminLeaseAgreements } from "@/hooks/useAdminData";

/**
 * Admin portal page listing every lease agreement, not the legacy user_data properties.
 */
export default function AdminAgreements() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useAdminLeaseAgreements();

  const agreements = data ?? [];
  const totalCount = agreements.length;

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "lease-agreements"] });
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Agreements</h2>
            <p className="mt-1 text-sm text-gray-500">
              {isLoading
                ? "Loading agreements…"
                : `${totalCount} ${totalCount === 1 ? "agreement" : "agreements"} across all brokers`}
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

        <AdminAgreementsTable
          agreements={agreements}
          isLoading={isLoading}
          isError={isError}
        />
      </div>
    </AdminLayout>
  );
}

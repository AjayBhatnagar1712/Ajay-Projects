/**
 * Admin feedback page — all user feedback submissions from the in-app widget
 */
import React from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminFeedbackTable } from "@/components/admin/AdminFeedbackTable";
import { Button } from "@/components/ui/button";
import { useAdminFeedback } from "@/hooks/useAdminData";

/**
 * Admin portal page listing all user feedback with ratings, categories, and messages.
 */
export default function AdminFeedback() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useAdminFeedback();

  const feedback = data ?? [];
  const totalCount = feedback.length;

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "feedback"] });
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Feedback</h2>
            <p className="mt-1 text-sm text-gray-500">
              {isLoading
                ? "Loading feedback…"
                : `${totalCount} ${totalCount === 1 ? "submission" : "submissions"} from users`}
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

        <AdminFeedbackTable feedback={feedback} isLoading={isLoading} isError={isError} />
      </div>
    </AdminLayout>
  );
}

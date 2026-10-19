import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export interface TenantMoveOutCardProps {
  loading?: boolean;
}

export function TenantMoveOutCard({ loading }: TenantMoveOutCardProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse h-[88px]" />
    );
  }

  const handleInitiateMoveOut = () => {
    toast({
      title: "Move-out process",
      description: "This flow will be available soon. Contact your owner or broker for now.",
    });
  };

  return (
    <div className="rounded-xl border border-[rgba(108,132,157,0.18)] bg-white p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3 items-start min-w-0">
          <LogOut size={24} className="text-[#192839] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#192839]">Planning to Move Out?</p>
            <p className="text-xs text-[#40566d] mt-1">
              Initiate at least 30 days before your intended date
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 px-5 rounded border-[#d92d20] text-[#d92d20] text-sm font-semibold hover:bg-red-50 shrink-0"
          onClick={handleInitiateMoveOut}
        >
          Initiate Move-Out Process
        </Button>
      </div>
    </div>
  );
}

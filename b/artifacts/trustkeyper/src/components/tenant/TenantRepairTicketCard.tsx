import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PropertyMaintenanceTicket } from "@/lib/ownerPropertyMaintenance";
import { formatTenantRepairReportedAt } from "@/lib/tenantRepairs";

function statusBadgeClass(status: PropertyMaintenanceTicket["status"]): string {
  return status === "Issue Solved"
    ? "bg-[#00a251] text-white"
    : "bg-primary text-white";
}

export interface TenantRepairTicketCardProps {
  ticket: PropertyMaintenanceTicket;
  ticketLabel: string;
  propertyLabel: string;
  onViewDetails: () => void;
}

export function TenantRepairTicketCard({
  ticket,
  ticketLabel,
  propertyLabel,
  onViewDetails,
}: TenantRepairTicketCardProps) {
  const thumb = ticket.images[0];

  return (
    <article className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5 rounded-xl border border-[rgba(108,132,157,0.18)] bg-white">
      <div className="w-full sm:w-28 h-28 sm:h-24 rounded-lg overflow-hidden border border-gray-100 bg-[#f8fafc] shrink-0">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-primary/30">
            <Wrench size={28} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-xs text-[#768ea7] font-medium tracking-wide">{ticketLabel}</p>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded shrink-0 ${statusBadgeClass(ticket.status)}`}
          >
            {ticket.status === "Pending" ? "Pending" : "Issue Solved"}
          </span>
        </div>

        <p className="text-sm sm:text-base font-semibold text-[#192839] leading-snug">
          {ticket.title}
          <span className="font-normal text-[#40566d]"> at {propertyLabel}</span>
        </p>
        <p className="text-xs text-[#768ea7] mt-1">
          Reported on {formatTenantRepairReportedAt(ticket.createdAt)}
        </p>

        <Button
          type="button"
          variant="outline"
          className="mt-3 w-fit h-10 rounded border-primary text-primary text-sm font-normal hover:bg-primary/5"
          onClick={onViewDetails}
        >
          View Details
        </Button>
      </div>
    </article>
  );
}

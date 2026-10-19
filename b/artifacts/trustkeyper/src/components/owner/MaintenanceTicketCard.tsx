import React from "react";
import { Wrench } from "lucide-react";
import type { PropertyMaintenanceTicket } from "@/lib/ownerPropertyMaintenance";
import { Button } from "@/components/ui/button";

function formatReportedAt(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: PropertyMaintenanceTicket["status"]): string {
  return status === "Issue Solved"
    ? "bg-green-600 text-white"
    : "bg-primary text-white";
}

export function MaintenanceTicketCard({
  ticket,
  ticketLabel,
  propertyLabel,
  onViewDetails,
  onStatusChange,
}: {
  ticket: PropertyMaintenanceTicket;
  ticketLabel: string;
  propertyLabel: string;
  onViewDetails: () => void;
  onStatusChange?: (status: PropertyMaintenanceTicket["status"]) => void;
}) {
  const thumb = ticket.images[0];

  return (
    <article className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="w-full sm:w-28 h-28 sm:h-24 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
        {thumb ? (
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <Wrench size={28} />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="text-xs text-gray-400 font-medium">{ticketLabel}</p>
          <button
            type="button"
            onClick={() =>
              onStatusChange?.(ticket.status === "Pending" ? "Issue Solved" : "Pending")
            }
            className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded shrink-0 ${statusBadgeClass(ticket.status)} ${
              onStatusChange ? "cursor-pointer hover:opacity-90" : "cursor-default"
            }`}
            title={onStatusChange ? "Tap to change status" : undefined}
          >
            {ticket.status === "Pending" ? "Pending" : "Issue Solved"}
          </button>
        </div>

        <p className="text-sm sm:text-base font-semibold text-gray-900 leading-snug">
          {ticket.title}
          <span className="font-normal text-gray-600"> at {propertyLabel}</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">Reported on {formatReportedAt(ticket.createdAt)}</p>

        <Button
          type="button"
          variant="outline"
          className="mt-3 w-fit h-9 rounded-[4px] text-sm font-semibold text-primary border-primary hover:bg-blue-50"
          onClick={onViewDetails}
        >
          View Details
        </Button>
      </div>
    </article>
  );
}

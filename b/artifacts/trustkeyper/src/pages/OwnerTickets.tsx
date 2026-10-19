import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Ticket, Wrench } from "lucide-react";
import OwnerLayout from "@/components/OwnerLayout";
import { OwnerPageEmpty } from "@/components/owner/OwnerPageEmpty";
import { RaiseComplaintModal } from "@/components/owner/RaiseComplaintModal";
import { OwnerFlowButton } from "@/components/owner/OwnerFlowButton";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { MaintenanceTicketCard } from "@/components/owner/MaintenanceTicketCard";
import { MaintenanceTicketDetailsModal } from "@/components/owner/MaintenanceTicketDetailsModal";
import {
  getAllMaintenanceTickets,
  getMaintenanceTicketById,
  MAINTENANCE_TICKETS_CHANGED,
  updateMaintenanceTicketStatus,
  type PropertyMaintenanceTicket,
} from "@/lib/ownerPropertyMaintenance";
import { getProperties, getPropertyTitle } from "@/lib/properties";

type FilterTab = "all" | "pending" | "solved";

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "solved", label: "Solved" },
];

export default function OwnerTickets() {
  const [logOpen, setLogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [tickets, setTickets] = useState<PropertyMaintenanceTicket[]>(() => getAllMaintenanceTickets());
  const [detailsTicket, setDetailsTicket] = useState<PropertyMaintenanceTicket | null>(null);

  const refresh = useCallback(() => {
    setTickets(getAllMaintenanceTickets());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(MAINTENANCE_TICKETS_CHANGED, onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(MAINTENANCE_TICKETS_CHANGED, onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [refresh]);

  const propertyLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of getProperties()) {
      map.set(p.id, getPropertyTitle(p));
    }
    return map;
  }, [tickets]);

  const visible = useMemo(() => {
    if (activeFilter === "pending") {
      return tickets.filter((t) => t.status === "Pending");
    }
    if (activeFilter === "solved") {
      return tickets.filter((t) => t.status === "Issue Solved");
    }
    return tickets;
  }, [tickets, activeFilter]);

  const ticketNumber = (ticket: PropertyMaintenanceTicket) => {
    const idx = tickets.findIndex((t) => t.id === ticket.id);
    return `Ticket- ${String(idx >= 0 ? idx + 1 : tickets.length).padStart(2, "0")}`;
  };

  return (
    <OwnerLayout>
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-primary font-semibold text-lg mb-6 hover:underline w-fit"
        >
          <ChevronLeft size={20} /> Back to Dashboard
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Maintenance Tickets</h1>
          <OwnerFlowButton type="button" onClick={() => setLogOpen(true)}>
            <Wrench size={16} />
            Raise Complaint
          </OwnerFlowButton>
        </div>

        <FlowSegmentTabs
          value={activeFilter}
          onChange={(value) => setActiveFilter(value as FilterTab)}
          options={FILTER_TABS}
          className="mb-6"
        />

        {visible.length === 0 ? (
          <OwnerPageEmpty
            icon={Ticket}
            title={activeFilter === "all" ? "No tickets" : `No ${activeFilter} tickets`}
            description="Log a maintenance issue from here or from an individual property — it will appear in both places."
          />
        ) : (
          <div className="space-y-4">
            {visible.map((ticket) => (
              <MaintenanceTicketCard
                key={ticket.id}
                ticket={ticket}
                ticketLabel={ticketNumber(ticket)}
                propertyLabel={propertyLabelById.get(ticket.propertyId) ?? "Property"}
                onViewDetails={() => setDetailsTicket(ticket)}
                onStatusChange={(status) => {
                  updateMaintenanceTicketStatus(ticket.id, status);
                  refresh();
                }}
              />
            ))}
          </div>
        )}
      </div>

      <RaiseComplaintModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSubmitted={refresh}
      />

      <MaintenanceTicketDetailsModal
        ticket={detailsTicket}
        propertyLabel={
          detailsTicket
            ? propertyLabelById.get(detailsTicket.propertyId) ?? "Property"
            : ""
        }
        open={Boolean(detailsTicket)}
        onClose={() => setDetailsTicket(null)}
        onUpdated={() => {
          refresh();
          if (detailsTicket) {
            const updated = getMaintenanceTicketById(detailsTicket.id);
            if (updated) setDetailsTicket(updated);
          }
        }}
      />
    </OwnerLayout>
  );
}

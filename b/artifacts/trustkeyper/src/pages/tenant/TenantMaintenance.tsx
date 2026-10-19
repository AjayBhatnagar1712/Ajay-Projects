import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Wrench } from "lucide-react";
import TenantLayout from "@/components/TenantLayout";
import { FlowSegmentTabs } from "@/components/FlowSegmentTabs";
import { Button } from "@/components/ui/button";
import { TenantRaiseComplaintModal } from "@/components/tenant/TenantRaiseComplaintModal";
import { TenantRepairDetailsModal } from "@/components/tenant/TenantRepairDetailsModal";
import { TenantRepairTicketCard } from "@/components/tenant/TenantRepairTicketCard";
import { TenantRepairsEmptyState } from "@/components/tenant/TenantRepairsEmptyState";
import { TenantRentBackLink } from "@/components/tenant/TenantRentBackLink";
import { toast } from "@/hooks/use-toast";
import {
  MAINTENANCE_TICKETS_CHANGED,
  type PropertyMaintenanceTicket,
} from "@/lib/ownerPropertyMaintenance";
import {
  buildTenantRepairsSnapshot,
  filterTenantRepairTickets,
  formatTenantRepairTicketLabel,
  type TenantRepairFilterTab,
  type TenantRepairsSnapshot,
} from "@/lib/tenantRepairs";
import { getActiveTenantWorkspace } from "@/lib/tenantWorkspace";

const FILTER_TABS: { value: TenantRepairFilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "solved", label: "Solved" },
];

export default function TenantMaintenance() {
  const [snapshot, setSnapshot] = useState<TenantRepairsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TenantRepairFilterTab>("all");
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [detailsTicket, setDetailsTicket] = useState<PropertyMaintenanceTicket | null>(null);

  const refresh = useCallback(() => {
    try {
      const workspace = getActiveTenantWorkspace();
      setSnapshot(buildTenantRepairsSnapshot(workspace));
      setLoadError(null);
    } catch {
      setLoadError("Could not load your repair requests. Please refresh the page.");
    } finally {
      setLoading(false);
    }
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

  const visibleTickets = useMemo(() => {
    if (!snapshot) return [];
    return filterTenantRepairTickets(snapshot.tickets, activeFilter);
  }, [snapshot, activeFilter]);

  const ticketLabelFor = (ticket: PropertyMaintenanceTicket) => {
    if (!snapshot) return "Ticket- 01";
    const index = snapshot.tickets.findIndex((row) => row.id === ticket.id);
    return formatTenantRepairTicketLabel(index >= 0 ? index : 0);
  };

  return (
    <TenantLayout>
      <div className="max-w-6xl mx-auto space-y-7">
        <TenantRentBackLink />

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3 items-start">
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{loadError}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl text-[#192839]">Repairs</h1>
            {!loading && snapshot ? (
              <p className="text-sm text-[#40566d] mt-1 tracking-wide">{snapshot.propertyLabel}</p>
            ) : (
              <div className="h-4 w-48 bg-gray-100 rounded mt-2 animate-pulse" />
            )}
          </div>
          <Button
            type="button"
            className="h-12 px-5 rounded text-base font-normal gap-2"
            disabled={loading}
            onClick={() => setRaiseOpen(true)}
          >
            <Wrench size={16} />
            Raise Complaint
          </Button>
        </div>

        <FlowSegmentTabs
          value={activeFilter}
          onChange={(value) => setActiveFilter(value as TenantRepairFilterTab)}
          options={FILTER_TABS}
        />

        {loading ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 animate-pulse min-h-[120px]" />
            <div className="rounded-xl bg-white p-5 animate-pulse min-h-[120px]" />
          </div>
        ) : visibleTickets.length === 0 ? (
          <TenantRepairsEmptyState
            title={activeFilter === "all" ? "No repair requests yet" : `No ${activeFilter} requests`}
            description="Raise a complaint to log plumbing, electrical, or other maintenance issues for your rental."
          />
        ) : (
          <div className="space-y-4">
            {visibleTickets.map((ticket) => (
              <TenantRepairTicketCard
                key={ticket.id}
                ticket={ticket}
                ticketLabel={ticketLabelFor(ticket)}
                propertyLabel={snapshot?.propertyLabel ?? "Property"}
                onViewDetails={() => setDetailsTicket(ticket)}
              />
            ))}
          </div>
        )}
      </div>

      <TenantRaiseComplaintModal
        open={raiseOpen}
        propertyId={snapshot?.propertyId ?? null}
        propertyLabel={snapshot?.propertyLabel ?? "Assigned Property"}
        onClose={() => setRaiseOpen(false)}
        onSubmitted={() => {
          refresh();
          toast({
            title: "Maintenance logged",
            description: "Your repair request has been recorded and shared with the owner.",
          });
        }}
      />

      <TenantRepairDetailsModal
        open={detailsTicket !== null}
        ticket={detailsTicket}
        propertyLabel={snapshot?.propertyLabel ?? "Property"}
        onClose={() => setDetailsTicket(null)}
      />
    </TenantLayout>
  );
}

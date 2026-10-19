import type { PropertyMaintenanceTicket } from "@/lib/ownerPropertyMaintenance";
import { getPropertyMaintenanceTickets } from "@/lib/ownerPropertyMaintenance";
import type { TenantWorkspaceRecord } from "@/lib/tenantWorkspace";

export const TENANT_REPAIR_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Painting",
  "Cleaning",
  "Appliance",
  "Structural",
  "Other",
] as const;

export type TenantRepairCategory = (typeof TENANT_REPAIR_CATEGORIES)[number];

export type TenantRepairFilterTab = "all" | "pending" | "solved";

export type TenantRepairsSnapshot = {
  propertyId: string | null;
  propertyLabel: string;
  tickets: PropertyMaintenanceTicket[];
  usingMockTickets: boolean;
};

function buildMockTickets(propertyId: string): PropertyMaintenanceTicket[] {
  const now = Date.now();
  return [
    {
      id: "tenant-repair-mock-1",
      propertyId,
      category: "Plumbing",
      title: "Kitchen tap leakage",
      description: "Water leaking from the kitchen tap handle when turned on.",
      images: [],
      status: "Pending",
      createdAt: now - 3 * 24 * 60 * 60 * 1000,
    },
    {
      id: "tenant-repair-mock-2",
      propertyId,
      category: "Electrical",
      title: "Bedroom switch not working",
      description: "The main light switch in bedroom 2 does not respond.",
      images: [],
      status: "Issue Solved",
      createdAt: now - 12 * 24 * 60 * 60 * 1000,
    },
  ];
}

export function buildTenantRepairsSnapshot(
  workspace: TenantWorkspaceRecord | null,
): TenantRepairsSnapshot {
  const propertyLabel =
    workspace?.propertyAddress?.trim() ||
    workspace?.propertyLabel?.trim() ||
    "Assigned Property";
  const propertyId = workspace?.propertyId ?? null;

  if (!propertyId) {
    return {
      propertyId: null,
      propertyLabel,
      tickets: buildMockTickets("tenant-repair-mock-property"),
      usingMockTickets: true,
    };
  }

  const storedTickets = getPropertyMaintenanceTickets(propertyId);
  if (storedTickets.length > 0) {
    return {
      propertyId,
      propertyLabel,
      tickets: storedTickets,
      usingMockTickets: false,
    };
  }

  return {
    propertyId,
    propertyLabel,
    tickets: buildMockTickets(propertyId),
    usingMockTickets: true,
  };
}

export function filterTenantRepairTickets(
  tickets: PropertyMaintenanceTicket[],
  filter: TenantRepairFilterTab,
): PropertyMaintenanceTicket[] {
  if (filter === "pending") {
    return tickets.filter((ticket) => ticket.status === "Pending");
  }
  if (filter === "solved") {
    return tickets.filter((ticket) => ticket.status === "Issue Solved");
  }
  return tickets;
}

export function formatTenantRepairTicketLabel(index: number): string {
  return `Ticket- ${String(index + 1).padStart(2, "0")}`;
}

export function formatTenantRepairReportedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function isMockTenantRepairTicket(ticketId: string): boolean {
  return ticketId.startsWith("tenant-repair-mock-");
}

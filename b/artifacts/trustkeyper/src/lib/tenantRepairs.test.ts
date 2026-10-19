import { describe, expect, it } from "vitest";
import {
  buildTenantRepairsSnapshot,
  filterTenantRepairTickets,
  formatTenantRepairTicketLabel,
  isMockTenantRepairTicket,
} from "./tenantRepairs";
import type { PropertyMaintenanceTicket } from "./ownerPropertyMaintenance";
import type { TenantWorkspaceRecord } from "./tenantWorkspace";

const workspace: TenantWorkspaceRecord = {
  phone: "9876543210",
  tenantName: "Meena",
  propertyId: "prop-401",
  propertyLabel: "Flat 401",
  propertyAddress: "Flat 401, Ayyappa Society, Madhapur",
  updatedAt: Date.now(),
};

describe("tenantRepairs", () => {
  it("builds mock tickets when no stored tickets exist", () => {
    const snapshot = buildTenantRepairsSnapshot(workspace);
    expect(snapshot.propertyLabel).toContain("Flat 401");
    expect(snapshot.tickets.length).toBeGreaterThanOrEqual(2);
    expect(snapshot.usingMockTickets).toBe(true);
  });

  it("filters tickets by status", () => {
    const tickets: PropertyMaintenanceTicket[] = [
      {
        id: "a",
        propertyId: "p",
        category: "Plumbing",
        title: "Leak",
        description: "Leak",
        images: [],
        status: "Pending",
        createdAt: 1,
      },
      {
        id: "b",
        propertyId: "p",
        category: "Electrical",
        title: "Switch",
        description: "Switch",
        images: [],
        status: "Issue Solved",
        createdAt: 2,
      },
    ];

    expect(filterTenantRepairTickets(tickets, "pending")).toHaveLength(1);
    expect(filterTenantRepairTickets(tickets, "solved")).toHaveLength(1);
    expect(filterTenantRepairTickets(tickets, "all")).toHaveLength(2);
  });

  it("formats ticket labels and detects mock ids", () => {
    expect(formatTenantRepairTicketLabel(0)).toBe("Ticket- 01");
    expect(isMockTenantRepairTicket("tenant-repair-mock-1")).toBe(true);
    expect(isMockTenantRepairTicket("mnt_123")).toBe(false);
  });
});

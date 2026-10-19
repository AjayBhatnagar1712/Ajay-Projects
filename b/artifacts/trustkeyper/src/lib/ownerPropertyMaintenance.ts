import { queueCloudSync } from "@/lib/cloudSync";
import { getItem, setItem } from "@/lib/storageKeys";

export type MaintenanceStatus = "Pending" | "Issue Solved";

export interface PropertyMaintenanceTicket {
  id: string;
  propertyId: string;
  category: string;
  title: string;
  description: string;
  images: string[];
  status: MaintenanceStatus;
  createdAt: number;
}

export const MAINTENANCE_TICKETS_CHANGED = "trustkeyper:maintenance-tickets-changed";

const STORAGE_KEY = "owner_property_maintenance";

function normalizeStatus(raw: unknown): MaintenanceStatus {
  if (raw === "Issue Solved" || raw === "Resolved") return "Issue Solved";
  return "Pending";
}

function readAll(): PropertyMaintenanceTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<PropertyMaintenanceTicket>[];
    return parsed
      .filter(
        (t): t is Partial<PropertyMaintenanceTicket> & { propertyId: string; id: string } =>
          Boolean(t?.id && t?.propertyId),
      )
      .map((t) => ({
        id: t.id!,
        propertyId: t.propertyId!,
        category: t.category ?? "Other",
        title: t.title ?? "",
        description: t.description ?? "",
        images: Array.isArray(t.images) ? t.images : [],
        status: normalizeStatus(t.status),
        createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
      }));
  } catch {
    return [];
  }
}

function notifyChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MAINTENANCE_TICKETS_CHANGED));
}

function persist(list: PropertyMaintenanceTicket[]): void {
  try {
    const json = JSON.stringify(list);
    setItem(STORAGE_KEY, json);
    queueCloudSync(STORAGE_KEY, json);
    notifyChanged();
  } catch {
    /* ignore */
  }
}

export function getAllMaintenanceTickets(): PropertyMaintenanceTicket[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getPropertyMaintenanceTickets(propertyId: string): PropertyMaintenanceTicket[] {
  return readAll()
    .filter((t) => t.propertyId === propertyId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getMaintenanceTicketById(ticketId: string): PropertyMaintenanceTicket | undefined {
  return readAll().find((t) => t.id === ticketId);
}

export function addPropertyMaintenanceTicket(
  input: Omit<PropertyMaintenanceTicket, "id" | "status" | "createdAt" | "images"> & {
    images?: string[];
  },
): PropertyMaintenanceTicket {
  const ticket: PropertyMaintenanceTicket = {
    ...input,
    images: input.images ?? [],
    id: `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    status: "Pending",
    createdAt: Date.now(),
  };
  const list = readAll();
  list.unshift(ticket);
  persist(list);
  return ticket;
}

export function updateMaintenanceTicketStatus(
  ticketId: string,
  status: MaintenanceStatus,
): PropertyMaintenanceTicket | undefined {
  const list = readAll();
  const idx = list.findIndex((t) => t.id === ticketId);
  if (idx < 0) return undefined;
  list[idx] = { ...list[idx], status };
  persist(list);
  return list[idx];
}

export function isMaintenancePending(status: MaintenanceStatus): boolean {
  return status === "Pending";
}

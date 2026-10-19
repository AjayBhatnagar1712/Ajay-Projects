import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, readJsonBody } from "./http.js";
import * as vercelDb from "./vercelSyncDb.js";

type StoredProperty = {
  id: string;
  status?: string;
  uploadedBy?: string;
  ownerName?: string;
  ownerContact?: string;
  coOwners?: { name?: string; contact?: string }[];
  [key: string]: unknown;
};

type PropertyShareSnapshot = {
  property: StoredProperty;
  sharedByPhone?: string;
  sharedByRole?: string;
  ownerPhone?: string;
  ownerRole?: string;
  updatedAt?: number;
};

type ShareInquiry = {
  id: string;
  name: string;
  phone: string;
  propertyId: string;
  propertyLabel: string;
  status: "open" | "invited";
  leadStatus?: "new" | "contacted" | "converted" | "rejected";
  source?: "property_share" | "manual";
  sharedBy?: "broker" | "owner";
  createdAt: number;
  updatedAt?: number;
};

function sharePathSegments(req: VercelRequest): string[] {
  const raw = req.query.sharePath ?? req.query.path;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string" && raw.length > 0) return raw.split("/").filter(Boolean);
  return [];
}

function phoneLast10(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function formatMemberContact(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    return `+91 ${digits.slice(-10)}`;
  }
  return phone;
}

function isActiveProperty(property: StoredProperty): boolean {
  return property.status === "Active" || property.status === undefined;
}

function resolveSharedByRole(
  snapshotRole?: string,
  property?: StoredProperty,
): "broker" | "owner" {
  if (snapshotRole === "broker" || snapshotRole === "owner") return snapshotRole;
  return property?.uploadedBy === "broker" ? "broker" : "owner";
}

function sanitizePropertyForPublic(property: StoredProperty, maskOwner: boolean): StoredProperty {
  if (!maskOwner) return property;
  return {
    ...property,
    ownerName: "",
    ownerContact: "",
    coOwners: [],
  };
}

async function findPropertyRecord(propertyId: string): Promise<{
  phone: string;
  role: string;
  property: StoredProperty;
  sharedBy: "broker" | "owner";
} | null> {
  if (!vercelDb.usePostgres()) return null;

  const snapshotRows = await vercelDb.queryRows<{ phone: string; role: string; value: string }>(
    `SELECT phone, role, value FROM user_data WHERE data_key = $1 LIMIT 1`,
    [`property_share_${propertyId}`],
  );
  if (snapshotRows[0]) {
    try {
      const snap = JSON.parse(snapshotRows[0].value) as PropertyShareSnapshot;
      if (snap.property?.id === propertyId && isActiveProperty(snap.property)) {
        const sharedBy = resolveSharedByRole(snap.sharedByRole, snap.property);
        const recipientPhone = snap.sharedByPhone ?? snapshotRows[0].phone;
        const recipientRole = snap.sharedByRole ?? snapshotRows[0].role;
        return {
          phone: recipientPhone,
          role: recipientRole,
          sharedBy,
          property: sanitizePropertyForPublic(snap.property, sharedBy === "broker"),
        };
      }
    } catch {
      /* fall through */
    }
  }

  const rows = await vercelDb.queryRows<{ phone: string; role: string; value: string }>(
    `SELECT phone, role, value FROM user_data WHERE data_key = 'properties'`,
  );

  for (const row of rows) {
    try {
      const list = JSON.parse(row.value) as StoredProperty[];
      if (!Array.isArray(list)) continue;
      const found = list.find((p) => p.id === propertyId);
      if (found && isActiveProperty(found)) {
        const sharedBy = resolveSharedByRole(row.role, found);
        return {
          phone: row.phone,
          role: row.role,
          sharedBy,
          property: sanitizePropertyForPublic(found, sharedBy === "broker"),
        };
      }
    } catch {
      /* ignore malformed row */
    }
  }

  return null;
}

function inquiriesDataKey(role: string): string {
  return role === "broker" ? "broker_property_inquiries" : "owner_tenant_inquiries";
}

async function appendShareInquiry(
  recipientPhone: string,
  recipientRole: string,
  inquiry: ShareInquiry,
): Promise<{ inquiry: ShareInquiry; isDuplicate: boolean }> {
  const dataKey = inquiriesDataKey(recipientRole);
  const data = await vercelDb.getAccountData(recipientPhone, recipientRole);
  const raw = data[dataKey];
  const list: ShareInquiry[] = raw ? (JSON.parse(raw) as ShareInquiry[]) : [];
  const digits = phoneLast10(inquiry.phone);
  const existing = list.find(
    (row) =>
      row.propertyId === inquiry.propertyId &&
      phoneLast10(row.phone) === digits &&
      row.source === "property_share" &&
      row.status === "open" &&
      row.leadStatus !== "rejected",
  );
  if (existing) {
    return { inquiry: existing, isDuplicate: true };
  }
  list.unshift(inquiry);
  await vercelDb.setAccountDataKey(recipientPhone, recipientRole, dataKey, JSON.stringify(list));
  return { inquiry, isDuplicate: false };
}

export async function handleSharePropertyRequest(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const segments = sharePathSegments(req);
  if (segments[0] !== "property" || !segments[1]) {
    json(res, 404, { error: "Not found" });
    return;
  }

  const propertyId = segments[1];

  if (segments.length === 2) {
    if (req.method !== "GET") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const record = await findPropertyRecord(propertyId);
    if (!record) {
      json(res, 404, { error: "Property not found" });
      return;
    }

    json(res, 200, {
      property: record.property,
      sharedBy: record.sharedBy,
      maskOwnerDetails: record.sharedBy === "broker",
    });
    return;
  }

  if (segments[2] === "inquiry") {
    if (req.method !== "POST") {
      json(res, 405, { error: "Method not allowed" });
      return;
    }

    const body = readJsonBody(req) as {
      name?: string;
      phone?: string;
      propertyLabel?: string;
      sharedBy?: "broker" | "owner";
    } | null;
    const name = body?.name?.trim() ?? "";
    const phone = body?.phone?.trim() ?? "";
    const propertyLabel = body?.propertyLabel?.trim() ?? "";

    if (name.length < 2) {
      json(res, 400, { error: "Name is required" });
      return;
    }
    if (phoneLast10(phone).length !== 10) {
      json(res, 400, { error: "Valid mobile number is required" });
      return;
    }

    const record = await findPropertyRecord(propertyId);
    if (!record) {
      json(res, 404, { error: "Property not found" });
      return;
    }

    const sharedBy = body?.sharedBy === "broker" || body?.sharedBy === "owner"
      ? body.sharedBy
      : record.sharedBy;

    const inquiry: ShareInquiry = {
      id: `inq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      phone: formatMemberContact(phone),
      propertyId,
      propertyLabel: propertyLabel || String(record.property.nickname ?? "Property"),
      status: "open",
      leadStatus: "new",
      source: "property_share",
      sharedBy,
      createdAt: Date.now(),
    };

    const result = await appendShareInquiry(record.phone, record.role, inquiry);
    json(res, 200, result);
    return;
  }

  json(res, 404, { error: "Not found" });
}

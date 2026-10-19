import { API_BASE } from "@/lib/apiBase";
import type { Property } from "@/lib/properties";
import { getProperties } from "@/lib/properties";
import { getActiveSession } from "@/lib/storageKeys";
import { propertyShareDataKey, pushAccountKeyToCloud } from "@/lib/cloudSync";
import { getPropertyInviteLabel } from "@/lib/ownerTenants";
import {
  resolveShareSource,
  sanitizePropertyForPublicShare,
  shouldMaskOwnerDetails,
  type PropertyShareSource,
} from "@/lib/propertyShareView";

export type SharedPropertyPayload = {
  property: Property;
  sharedBy: PropertyShareSource;
  maskOwnerDetails: boolean;
};

function shareSnapshotKey(propertyId: string): string {
  return propertyShareDataKey(propertyId);
}

export async function fetchSharedProperty(propertyId: string): Promise<SharedPropertyPayload | null> {
  try {
    const res = await fetch(`${API_BASE}/share/property/${encodeURIComponent(propertyId)}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        property?: Property;
        sharedBy?: PropertyShareSource;
        maskOwnerDetails?: boolean;
      };
      if (json.property?.id === propertyId) {
        const sharedBy = resolveShareSource(json.sharedBy, json.property);
        const maskOwnerDetails = json.maskOwnerDetails ?? shouldMaskOwnerDetails(sharedBy, json.property);
        return {
          property: sanitizePropertyForPublicShare(json.property, maskOwnerDetails),
          sharedBy,
          maskOwnerDetails,
        };
      }
    }
  } catch {
    /* fall through to local */
  }

  if (typeof window === "undefined") return null;
  const local = getProperties().find((p) => p.id === propertyId) ?? null;
  if (!local) return null;
  const sharedBy = resolveShareSource(null, local);
  const maskOwnerDetails = shouldMaskOwnerDetails(sharedBy, local);
  return {
    property: sanitizePropertyForPublicShare(local, maskOwnerDetails),
    sharedBy,
    maskOwnerDetails,
  };
}

export async function publishPropertyShare(property: Property): Promise<void> {
  const session = getActiveSession();
  if (!session) return;

  const sharedByRole = session.role === "broker" ? "broker" : "owner";
  const payload = JSON.stringify({
    property,
    sharedByPhone: session.phone,
    sharedByRole,
    updatedAt: Date.now(),
  });

  try {
    const key = shareSnapshotKey(property.id);
    localStorage.setItem(`tk_${session.phone}_${session.role}_${key}`, payload);
    sessionStorage.setItem(`tk_${session.phone}_${session.role}_${key}`, payload);
    await pushAccountKeyToCloud(session.phone, session.role as "owner" | "broker", key, payload);
  } catch {
    /* non-blocking */
  }
}

export async function submitPropertyShareInquiry(input: {
  propertyId: string;
  name: string;
  phone: string;
  propertyLabel: string;
  sharedBy?: PropertyShareSource;
}): Promise<{ ok: boolean; isDuplicate?: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${API_BASE}/share/property/${encodeURIComponent(input.propertyId)}/inquiry`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name: input.name,
          phone: input.phone,
          propertyLabel: input.propertyLabel,
          sharedBy: input.sharedBy,
        }),
      },
    );
    if (res.ok) {
      const json = (await res.json()) as { isDuplicate?: boolean };
      return { ok: true, isDuplicate: json.isDuplicate };
    }
    const err = (await res.json().catch(() => null)) as { error?: string } | null;
    return { ok: false, error: err?.error ?? "Could not submit inquiry" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

export function getPropertyShareLabel(property: Property): string {
  return getPropertyInviteLabel(property);
}

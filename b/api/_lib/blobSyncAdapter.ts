import pg from "pg";
import { getPool } from "./vercelSyncDb.js";

function toPaise(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Math.round(parseFloat(String(value)) * 100);
  return Number.isNaN(n) ? 0 : n;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function optionalStr(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length > 0 ? s : null;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function jsonb(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

function toTimestamp(value: unknown): Date | null {
  if (value == null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return new Date(value);
  if (typeof value === "string" && value.length > 0) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function adaptProfile(phone: string, role: string, value: string): Promise<void> {
  const profile = parseJson<Record<string, unknown>>(value);
  if (!profile || typeof profile !== "object") return;

  await getPool().query(
    `INSERT INTO public.profiles (
      phone, role, name, email, firm, property_count, property_intent, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (phone, role) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      firm = EXCLUDED.firm,
      property_count = EXCLUDED.property_count,
      property_intent = EXCLUDED.property_intent,
      updated_at = NOW()`,
    [
      phone,
      role,
      str(profile.name),
      str(profile.email),
      str(profile.firm),
      optionalStr(profile.propertyCount),
      optionalStr(profile.propertyIntent),
    ],
  );

  await getPool().query(
    `INSERT INTO public.payment_accounts (
      id, phone, role, bank_holder_name, bank_name, bank_account_number, bank_ifsc, upi_id, updated_at
    ) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (phone, role) DO UPDATE SET
      bank_holder_name = EXCLUDED.bank_holder_name,
      bank_name = EXCLUDED.bank_name,
      bank_account_number = EXCLUDED.bank_account_number,
      bank_ifsc = EXCLUDED.bank_ifsc,
      upi_id = EXCLUDED.upi_id,
      updated_at = NOW()`,
    [
      phone,
      role,
      str(profile.bankHolderName),
      str(profile.bankName),
      str(profile.bankAccountNumber),
      str(profile.bankIFSC),
      str(profile.upiId),
    ],
  );
}

async function adaptProperties(phone: string, role: string, value: string): Promise<void> {
  const items = parseJson<Record<string, unknown>[]>(value);
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const id = str(item.id);
    if (!id) continue;

    const listingDetails = JSON.stringify({
      amenities: item.amenities ?? [],
      tenantsPreferred: item.tenantsPreferred ?? [],
    });

    const imagesArray = Array.isArray(item.images)
      ? item.images.filter((img): img is string => typeof img === "string")
      : [];
    const imagesUrls = imagesArray.filter((img) => img.startsWith("https://"));
    const imagesLegacy = imagesArray.filter((img) => img.startsWith("data:"));

    await getPool().query(
      `INSERT INTO public.properties (
        id, account_phone, account_role, nickname, address, area, city, pincode, country,
        owner_name, owner_contact, property_type, property_type_other, unit_size, unit_size_other,
        furnishing, built_up_area, built_up_units, total_floors, bedrooms, bathrooms, balconies,
        floor_level, main_door_direction, monthly_rent_paise, rent_negotiable, maintenance_included,
        monthly_maintenance_paise, security_deposit_paise, available_from, status, uploaded_by,
        images_urls, images_legacy, listing_details, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32,
        $33::jsonb, $34::jsonb, $35::jsonb, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        account_phone = EXCLUDED.account_phone,
        account_role = EXCLUDED.account_role,
        nickname = EXCLUDED.nickname,
        address = EXCLUDED.address,
        area = EXCLUDED.area,
        city = EXCLUDED.city,
        pincode = EXCLUDED.pincode,
        country = EXCLUDED.country,
        owner_name = EXCLUDED.owner_name,
        owner_contact = EXCLUDED.owner_contact,
        property_type = EXCLUDED.property_type,
        property_type_other = EXCLUDED.property_type_other,
        unit_size = EXCLUDED.unit_size,
        unit_size_other = EXCLUDED.unit_size_other,
        furnishing = EXCLUDED.furnishing,
        built_up_area = EXCLUDED.built_up_area,
        built_up_units = EXCLUDED.built_up_units,
        total_floors = EXCLUDED.total_floors,
        bedrooms = EXCLUDED.bedrooms,
        bathrooms = EXCLUDED.bathrooms,
        balconies = EXCLUDED.balconies,
        floor_level = EXCLUDED.floor_level,
        main_door_direction = EXCLUDED.main_door_direction,
        monthly_rent_paise = EXCLUDED.monthly_rent_paise,
        rent_negotiable = EXCLUDED.rent_negotiable,
        maintenance_included = EXCLUDED.maintenance_included,
        monthly_maintenance_paise = EXCLUDED.monthly_maintenance_paise,
        security_deposit_paise = EXCLUDED.security_deposit_paise,
        available_from = EXCLUDED.available_from,
        status = EXCLUDED.status,
        uploaded_by = EXCLUDED.uploaded_by,
        images_urls = EXCLUDED.images_urls,
        images_legacy = EXCLUDED.images_legacy,
        listing_details = EXCLUDED.listing_details,
        updated_at = NOW()`,
      [
        id,
        phone,
        role,
        optionalStr(item.nickname),
        str(item.address),
        str(item.area),
        str(item.city),
        str(item.pincode),
        str(item.country, "India"),
        str(item.ownerName),
        str(item.ownerContact),
        str(item.propertyType),
        optionalStr(item.propertyTypeOther),
        str(item.unitSize),
        optionalStr(item.unitSizeOther),
        str(item.furnishing),
        str(item.builtUpArea),
        str(item.builtUpUnits),
        str(item.totalFloors),
        str(item.bedrooms),
        str(item.bathrooms),
        str(item.balconies),
        str(item.floorLevel),
        str(item.mainDoorDirection),
        toPaise(item.monthlyRent),
        bool(item.rentNegotiable),
        bool(item.maintenanceIncluded),
        toPaise(item.monthlyMaintenance),
        toPaise(item.securityDeposit),
        str(item.availableFrom),
        str(item.status, "Draft"),
        optionalStr(item.uploadedBy),
        jsonb(imagesUrls.length > 0 ? imagesUrls : null),
        jsonb(imagesLegacy.length > 0 ? imagesLegacy : null),
        listingDetails,
      ],
    );

    await getPool().query(`DELETE FROM public.property_co_owners WHERE property_id = $1`, [id]);

    const coOwners = item.coOwners;
    if (Array.isArray(coOwners)) {
      for (const co of coOwners) {
        if (typeof co !== "object" || co === null) continue;
        const row = co as Record<string, unknown>;
        await getPool().query(
          `INSERT INTO public.property_co_owners (id, property_id, name, contact, created_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())`,
          [id, str(row.name), str(row.contact)],
        );
      }
    }
  }
}

async function adaptTenants(phone: string, role: string, value: string): Promise<void> {
  const items = parseJson<Record<string, unknown>[]>(value);
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const id = str(item.id);
    if (!id) continue;

    const profile =
      typeof item.profile === "object" && item.profile !== null
        ? (item.profile as Record<string, unknown>)
        : null;

    await getPool().query(
      `INSERT INTO public.tenants (
        id, account_phone, account_role, name, phone, who, food, city,
        localities, property_type, sharing, roommate, identify, occupancy_from,
        aadhaar_url, pan_url, status, invitation_sent, details_complete, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9::jsonb, $10, $11, $12::jsonb, $13::jsonb, $14,
        $15, $16, $17, $18, $19, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        account_phone = EXCLUDED.account_phone,
        account_role = EXCLUDED.account_role,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        who = EXCLUDED.who,
        food = EXCLUDED.food,
        city = EXCLUDED.city,
        localities = EXCLUDED.localities,
        property_type = EXCLUDED.property_type,
        sharing = EXCLUDED.sharing,
        roommate = EXCLUDED.roommate,
        identify = EXCLUDED.identify,
        occupancy_from = EXCLUDED.occupancy_from,
        aadhaar_url = EXCLUDED.aadhaar_url,
        pan_url = EXCLUDED.pan_url,
        status = EXCLUDED.status,
        invitation_sent = EXCLUDED.invitation_sent,
        details_complete = EXCLUDED.details_complete,
        updated_at = NOW()`,
      [
        id,
        phone,
        role,
        str(item.name),
        str(item.phone),
        optionalStr(item.who),
        optionalStr(item.food),
        optionalStr(item.city),
        jsonb(item.localities),
        optionalStr(item.propertyType),
        optionalStr(item.sharing),
        jsonb(item.roommate),
        jsonb(item.identify),
        optionalStr(item.occupancyFrom),
        profile ? optionalStr(profile.aadhaar) : null,
        profile ? optionalStr(profile.pan) : null,
        str(item.status, "Lead Added"),
        bool(item.invitationSent),
        bool(item.detailsComplete),
      ],
    );
  }
}

function parseAgreementCustomText(customText: unknown): {
  rentSplitMode: string | null;
  rentSplits: string | null;
  agreementText: string | null;
} {
  if (customText == null || customText === "") {
    return { rentSplitMode: null, rentSplits: null, agreementText: null };
  }

  if (typeof customText === "string") {
    const parsed = parseJson<Record<string, unknown>>(customText);
    if (parsed && typeof parsed === "object" && "rentSplitMode" in parsed) {
      return {
        rentSplitMode: optionalStr(parsed.rentSplitMode),
        rentSplits: jsonb(parsed.rentSplits),
        agreementText: optionalStr(parsed.agreementText),
      };
    }
    return { rentSplitMode: null, rentSplits: null, agreementText: customText };
  }

  if (typeof customText === "object" && customText !== null && "rentSplitMode" in customText) {
    const obj = customText as Record<string, unknown>;
    return {
      rentSplitMode: optionalStr(obj.rentSplitMode),
      rentSplits: jsonb(obj.rentSplits),
      agreementText: optionalStr(obj.agreementText),
    };
  }

  return { rentSplitMode: null, rentSplits: null, agreementText: String(customText) };
}

async function adaptAgreements(phone: string, role: string, value: string): Promise<void> {
  const items = parseJson<Record<string, unknown>[]>(value);
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const id = str(item.id);
    if (!id) continue;

    const custom = parseAgreementCustomText(item.customText);

    await getPool().query(
      `INSERT INTO public.agreements (
        id, account_phone, account_role, property_id, property_title, owner_name, owner_contact,
        tenant_id, tenant_name, tenant_contact, tenant_aadhaar, tenant_pan,
        co_tenant_name, co_tenant_contact, start_date, end_date,
        monthly_rent_paise, security_deposit_paise, lock_in_period, notice_period, rent_due_day,
        maintenance_charges_paise, maintenance_included, brokerage_amount_paise,
        brokerage_paid_by, brokerage_mode, rent_split_mode, rent_splits, agreement_text,
        status, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27, $28::jsonb, $29,
        $30, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        account_phone = EXCLUDED.account_phone,
        account_role = EXCLUDED.account_role,
        property_id = EXCLUDED.property_id,
        property_title = EXCLUDED.property_title,
        owner_name = EXCLUDED.owner_name,
        owner_contact = EXCLUDED.owner_contact,
        tenant_id = EXCLUDED.tenant_id,
        tenant_name = EXCLUDED.tenant_name,
        tenant_contact = EXCLUDED.tenant_contact,
        tenant_aadhaar = EXCLUDED.tenant_aadhaar,
        tenant_pan = EXCLUDED.tenant_pan,
        co_tenant_name = EXCLUDED.co_tenant_name,
        co_tenant_contact = EXCLUDED.co_tenant_contact,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        monthly_rent_paise = EXCLUDED.monthly_rent_paise,
        security_deposit_paise = EXCLUDED.security_deposit_paise,
        lock_in_period = EXCLUDED.lock_in_period,
        notice_period = EXCLUDED.notice_period,
        rent_due_day = EXCLUDED.rent_due_day,
        maintenance_charges_paise = EXCLUDED.maintenance_charges_paise,
        maintenance_included = EXCLUDED.maintenance_included,
        brokerage_amount_paise = EXCLUDED.brokerage_amount_paise,
        brokerage_paid_by = EXCLUDED.brokerage_paid_by,
        brokerage_mode = EXCLUDED.brokerage_mode,
        rent_split_mode = EXCLUDED.rent_split_mode,
        rent_splits = EXCLUDED.rent_splits,
        agreement_text = EXCLUDED.agreement_text,
        status = EXCLUDED.status,
        updated_at = NOW()`,
      [
        id,
        phone,
        role,
        null, // FK backfilled after full migration.
        str(item.propertyTitle),
        str(item.ownerName),
        str(item.ownerContact),
        null, // FK backfilled after full migration.
        str(item.tenantName),
        str(item.tenantContact),
        optionalStr(item.tenantAadhaar),
        optionalStr(item.tenantPan),
        optionalStr(item.coTenantName),
        optionalStr(item.coTenantContact),
        str(item.startDate),
        optionalStr(item.endDate),
        toPaise(item.monthlyRent),
        toPaise(item.securityDeposit),
        str(item.lockInPeriod),
        str(item.noticePeriod),
        str(item.rentDueDay),
        toPaise(item.maintenanceCharges),
        bool(item.maintenanceIncluded),
        toPaise(item.brokerageAmount),
        optionalStr(item.brokeragePaidBy),
        optionalStr(item.brokerageMode),
        custom.rentSplitMode,
        custom.rentSplits,
        custom.agreementText,
        str(item.status, "Draft"),
      ],
    );
  }
}

async function adaptInquiries(phone: string, role: string, value: string): Promise<void> {
  const items = parseJson<Record<string, unknown>[]>(value);
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const id = str(item.id);
    if (!id) continue;

    await getPool().query(
      `INSERT INTO public.property_inquiries (
        id, account_phone, account_role, property_id, property_label, name, phone,
        who, food, linkedin_url, status, lead_status, source, shared_by, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        account_phone = EXCLUDED.account_phone,
        account_role = EXCLUDED.account_role,
        property_id = EXCLUDED.property_id,
        property_label = EXCLUDED.property_label,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        who = EXCLUDED.who,
        food = EXCLUDED.food,
        linkedin_url = EXCLUDED.linkedin_url,
        status = EXCLUDED.status,
        lead_status = EXCLUDED.lead_status,
        source = EXCLUDED.source,
        shared_by = EXCLUDED.shared_by,
        updated_at = NOW()`,
      [
        id,
        phone,
        role,
        null, // FK backfilled by migration script.
        str(item.propertyLabel),
        str(item.name),
        str(item.phone),
        optionalStr(item.who),
        optionalStr(item.food),
        optionalStr(item.linkedinUrl),
        str(item.status, "open"),
        optionalStr(item.leadStatus),
        optionalStr(item.source),
        optionalStr(item.sharedBy),
      ],
    );
  }
}

async function adaptInvites(phone: string, role: string, value: string): Promise<void> {
  const items = parseJson<Record<string, unknown>[]>(value);
  if (!Array.isArray(items)) return;

  for (const item of items) {
    const id = str(item.id);
    if (!id) continue;

    await getPool().query(
      `INSERT INTO public.property_invites (
        id, account_phone, account_role, property_id, property_label, inquiry_id, invitation_id,
        name, phone, who, food, linkedin_url,
        monthly_rent_paise, maintenance_included, monthly_maintenance_paise, security_deposit_paise,
        start_date, status, accepted_at, rejected_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20
      )
      ON CONFLICT (id) DO UPDATE SET
        account_phone = EXCLUDED.account_phone,
        account_role = EXCLUDED.account_role,
        property_id = EXCLUDED.property_id,
        property_label = EXCLUDED.property_label,
        inquiry_id = EXCLUDED.inquiry_id,
        invitation_id = EXCLUDED.invitation_id,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        who = EXCLUDED.who,
        food = EXCLUDED.food,
        linkedin_url = EXCLUDED.linkedin_url,
        monthly_rent_paise = EXCLUDED.monthly_rent_paise,
        maintenance_included = EXCLUDED.maintenance_included,
        monthly_maintenance_paise = EXCLUDED.monthly_maintenance_paise,
        security_deposit_paise = EXCLUDED.security_deposit_paise,
        start_date = EXCLUDED.start_date,
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at,
        rejected_at = EXCLUDED.rejected_at`,
      [
        id,
        phone,
        role,
        null, // FK backfilled by migration script.
        str(item.propertyLabel),
        null, // FK backfilled by migration script.
        optionalStr(item.invitationId),
        str(item.name),
        str(item.phone),
        optionalStr(item.who),
        optionalStr(item.food),
        optionalStr(item.linkedinUrl),
        toPaise(item.monthlyRent),
        bool(item.maintenanceIncluded),
        toPaise(item.monthlyMaintenance),
        toPaise(item.securityDeposit),
        str(item.startDate),
        optionalStr(item.status) ?? "pending",
        toTimestamp(item.acceptedAt),
        toTimestamp(item.rejectedAt),
      ],
    );
  }
}

export type AdaptBlobWriteResult =
  | { status: "ok" }
  | { status: "skipped" }
  | { status: "error"; message: string };

export async function adaptBlobWrite(
  phone: string,
  role: string,
  dataKey: string,
  value: string,
): Promise<AdaptBlobWriteResult> {
  try {
    switch (dataKey) {
      case "profile":
        await adaptProfile(phone, role, value);
        break;
      case "properties":
        await adaptProperties(phone, role, value);
        break;
      case "tenants":
        await adaptTenants(phone, role, value);
        break;
      case "agreements":
        await adaptAgreements(phone, role, value);
        break;
      case "owner_tenant_inquiries":
      case "broker_property_inquiries":
        await adaptInquiries(phone, role, value);
        break;
      case "owner_tenant_invites":
        await adaptInvites(phone, role, value);
        break;
      default:
        return { status: "skipped" };
    }
    return { status: "ok" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[blobSyncAdapter] adaptBlobWrite failed", { phone, role, dataKey, err });
    return { status: "error", message };
  }
}

import type { LeaseAgreementPatch, LeaseInventoryReplace, LeasePartiesReplace } from "@workspace/api-schemas";
import { LeasePartiesReplaceSchema } from "@workspace/api-schemas";
import type { LeaseAgreementDetail } from "../api/client";
import { detailPartiesAsInput } from "./rolePartyMerge";

const snapshots = new Map<string, LeaseAgreementDetail>();

function cloneDetail(detail: LeaseAgreementDetail): LeaseAgreementDetail {
  return {
    ...detail,
    parties: detail.parties.map((party) => ({ ...party })),
    inventory: detail.inventory.map((item) => ({ ...item })),
  };
}

/** Deep-copy the draft as it was when Preview or Review-screen "Edit draft" was tapped. */
export function capturePreviewEditSnapshot(detail: LeaseAgreementDetail): void {
  snapshots.set(detail.id, cloneDetail(detail));
}

export function peekPreviewEditSnapshot(
  agreementId: string,
): LeaseAgreementDetail | undefined {
  return snapshots.get(agreementId);
}

export function clearPreviewEditSnapshot(agreementId: string): void {
  snapshots.delete(agreementId);
}

/** Test helper — do not use in product code. */
export function clearAllPreviewEditSnapshots(): void {
  snapshots.clear();
}

export function scalarPatchFromDetail(
  detail: LeaseAgreementDetail,
): LeaseAgreementPatch {
  return {
    executionDate: detail.executionDate,
    effectiveDate: detail.effectiveDate,
    endDate: detail.endDate,
    executionCity: detail.executionCity,
    durationMonths: detail.durationMonths,
    minStayMonths: detail.minStayMonths,
    noticePeriodLicenseeMonths: detail.noticePeriodLicenseeMonths,
    noticePeriodLicensorMonths: detail.noticePeriodLicensorMonths,
    monthlyRentPaise: detail.monthlyRentPaise,
    securityDepositPaise: detail.securityDepositPaise,
    rentDueDay: detail.rentDueDay,
    maintenanceIncluded: detail.maintenanceIncluded,
    monthlyMaintenancePaise: detail.monthlyMaintenancePaise,
    propertyAddress: detail.propertyAddress,
    areaSqft: detail.areaSqft,
    facing: detail.facing,
    carParkingCount: detail.carParkingCount,
  };
}

export function inventoryReplaceFromDetail(
  detail: LeaseAgreementDetail,
): LeaseInventoryReplace {
  return {
    items: [...detail.inventory]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((item, index) => ({
        description: item.description,
        quantity: item.quantity,
        sortOrder: index,
      })),
  };
}

export function partiesReplaceFromDetail(
  detail: LeaseAgreementDetail,
): LeasePartiesReplace | null {
  const parsed = LeasePartiesReplaceSchema.safeParse({
    parties: detailPartiesAsInput(detail.parties),
  });
  return parsed.success ? parsed.data : null;
}

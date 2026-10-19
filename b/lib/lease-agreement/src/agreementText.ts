import {
  formatDayMonthYearWithSuffix,
  formatInrPaise,
  ordSuffix,
} from "./format.js";
import type {
  LeaseAgreementPdfInput,
  LeaseInventoryItemPdfInput,
  LeasePartyPdfInput,
} from "./types.js";

/** Commercially important values tinted on the public review page. */
export type LeaseAgreementHighlightKind =
  | "rent"
  | "deposit"
  | "startDate"
  | "endDate"
  | "noticeLicensee"
  | "noticeLicensor"
  | "minStay"
  | "partyName";

export type LeaseAgreementTextRun = {
  text: string;
  highlight?: LeaseAgreementHighlightKind;
};

/** One visual/line unit of the agreement; flatten joins runs then joins lines with `\n`. */
export type LeaseAgreementDocumentLine = {
  runs: LeaseAgreementTextRun[];
};

export type LeaseAgreementDocument = {
  lines: LeaseAgreementDocumentLine[];
};

function sortParties(parties: LeasePartyPdfInput[]): LeasePartyPdfInput[] {
  return [...parties].sort((a, b) => a.sortOrder - b.sortOrder);
}

function sortInventoryItems(
  items: LeaseInventoryItemPdfInput[],
): LeaseInventoryItemPdfInput[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function formatPartyIdentityLine(party: LeasePartyPdfInput): string {
  const aadhaar = party.aadhaar?.trim();
  const pan = party.pan?.trim().toUpperCase();
  if (!aadhaar) return pan ? `# PAN NUMBER :- ${pan}` : "";
  if (pan) {
    return `# AADHAR NUMBER :- ${aadhaar} PAN NUMBER :- ${pan}`;
  }
  return `# AADHAR NUMBER :- ${aadhaar}`;
}

function formatAreaSqft(areaSqft: number | null): string {
  if (areaSqft == null || !Number.isFinite(areaSqft)) return "-";
  return Number.isInteger(areaSqft) ? String(areaSqft) : String(areaSqft);
}

function formatParking(count: number | null): string {
  if (count == null || count <= 0) return "0 Car Parking";
  return `${count} Car Parking`;
}

function formatMonthNotice(months: number): string {
  return `${months} month${months === 1 ? "" : "s"}`;
}

function splitPropertyAddress(
  propertyAddress: string,
): { unitIdentifier: string; propertyName: string } {
  const segments = propertyAddress
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 2) {
    return {
      unitIdentifier: propertyAddress.trim(),
      propertyName: propertyAddress.trim(),
    };
  }

  return {
    unitIdentifier: segments.slice(0, 2).join(", "),
    propertyName: segments.slice(2).join(", "),
  };
}

function t(text: string): LeaseAgreementTextRun {
  return { text };
}

function h(
  text: string,
  highlight: LeaseAgreementHighlightKind,
): LeaseAgreementTextRun {
  return { text, highlight };
}

function line(...runs: LeaseAgreementTextRun[]): LeaseAgreementDocumentLine {
  return { runs };
}

function joinRuns(runs: LeaseAgreementTextRun[]): string {
  return runs.map((run) => run.text).join("");
}

/** Flatten structured document to the PDF/text body (word-identical to prior builder). */
export function flattenLeaseAgreementDocument(
  document: LeaseAgreementDocument,
): string {
  return document.lines.map((entry) => joinRuns(entry.runs)).join("\n");
}

function partyBlockLines(parties: LeasePartyPdfInput[]): LeaseAgreementDocumentLine[] {
  const lines: LeaseAgreementDocumentLine[] = [];
  for (const party of parties) {
    const title = party.title?.trim() || "Mr./Ms.";
    const age = party.age ?? "-";
    const address = party.address?.trim() || "-";
    lines.push(
      line(
        t(`${title} `),
        h(party.name, "partyName"),
        t(`, AGED ABOUT ${age} YEARS R/O :- ${address}`),
      ),
    );
    const identityLine = formatPartyIdentityLine(party);
    if (identityLine) {
      lines.push(line(t(identityLine)));
    }
  }
  return lines;
}

function annexureLines(items: LeaseInventoryItemPdfInput[]): LeaseAgreementDocumentLine[] {
  const sorted = sortInventoryItems(items);
  if (sorted.length === 0) {
    return [line(t("*All Amenities are in good working condition as mentioned above."))];
  }
  return [
    line(t("Description | Quantity")),
    ...sorted.map((item) =>
      line(t(`${item.description} | ${item.quantity}`)),
    ),
    line(t("*All Amenities are in good working condition as mentioned above.")),
  ];
}

/**
 * Structured Leave & Licence body used by PDF (flattened) and the public review page (HTML).
 * Highlight kinds mark only commercially important inline values — not clause headings.
 */
export function generateLeaseAgreementDocument(
  input: LeaseAgreementPdfInput,
): LeaseAgreementDocument {
  const parties = sortParties(input.parties);
  const owners = parties.filter((p) => p.role === "owner");
  const tenants = parties.filter((p) => p.role === "tenant");
  const executionDate = formatDayMonthYearWithSuffix(input.executionDate);
  const effectiveDate = formatDayMonthYearWithSuffix(input.effectiveDate);
  const endDate = formatDayMonthYearWithSuffix(input.endDate);
  const areaSqft = formatAreaSqft(input.areaSqft);
  const facing = input.facing?.trim()
    ? `${input.facing.trim().toUpperCase()} FACING`
    : "";
  const carParking = formatParking(input.carParkingCount);
  const rentDueDay = `${input.rentDueDay}${ordSuffix(input.rentDueDay)}`;
  const { unitIdentifier, propertyName } = splitPropertyAddress(
    input.propertyAddress,
  );
  const rent = formatInrPaise(input.monthlyRentPaise);
  const deposit = formatInrPaise(input.securityDepositPaise);
  const noticeLicensee = formatMonthNotice(input.noticePeriodLicenseeMonths);
  const noticeLicensor = formatMonthNotice(input.noticePeriodLicensorMonths);
  const minStay = String(input.minStayMonths);

  const lines: LeaseAgreementDocumentLine[] = [
    // TODO: Insert the stamp-paper first page here once Aman finalises the eStamp workflow.
    line(t("LEAVE & LICENCE AGREEMENT")),
    line(
      t(
        `This LEAVE AND LICENCE AGREEMENT (“Agreement”) is made on this Day of ${executionDate} and shall be effective from `,
      ),
      h(effectiveDate, "startDate"),
      t("."),
    ),
    line(t("BETWEEN")),
    ...partyBlockLines(owners),
    line(
      t(
        'Hereinafter collectively called as "OWNER" and / or “LICENSOR” OF THE ONE PART.',
      ),
    ),
    line(t("AND")),
    ...partyBlockLines(tenants),
    line(t("Hereinafter called as “LICENSEES” OF THE OTHER PART.")),
    line(
      t(
        "WHEREAS, the LICENSOR is the sole and absolute owner of, and/or lawfully entitled to, the possession of the immovable property more particularly described hereinbelow, having acquired the same through valid title documents, and is fully competent to lease out the said Premises.",
      ),
    ),
    line(
      t(
        `AND WHEREAS, the LICENSOR is the owner of the Premises, which is measuring about approx. ${areaSqft}sq.ft., constructed on the property, located at ${unitIdentifier}${facing ? `, ${facing}` : ""}, along with ${carParking} in ${propertyName}. This is also described in the Annexure - 1 hereunder written. The said premise is the subject matter of this Agreement (hereinafter referred to as the "Premises")`,
      ),
    ),
    line(
      t(
        "AND WHEREAS, the LICENSOR did not presently require the said Premises and hence intended to give the same on leave and licence basis for temporary period solely for the purposes of residential accommodation, together with the use of the common areas and facilities of the building/project as permissible under applicable laws and the rules of the housing society/association, subject to the terms and conditions of this Agreement.",
      ),
    ),
    line(
      t(
        "AND WHEREAS, the LICENSOR has agreed to let out the said Premises to the LICENSEES solely for the purposes of residential accommodation, together with the use of the common areas and facilities of the building/project as permissible under applicable laws and the rules of the housing society/association, subject to the terms and conditions of this Agreement.",
      ),
    ),
    line(
      t(
        `AND WHEREAS, the LICENSOR as proposed by the LICENSEES has agreed to grant licence and allow the party of the other part to use the said Premises for a period of ${input.durationMonths} months commencing from `,
      ),
      h(effectiveDate, "startDate"),
      t(" to "),
      h(endDate, "endDate"),
      t(" on Leave & Licence basis on the following terms and conditions."),
    ),
    line(
      t(
        "NOW THEREFORE THIS DEED WITNESSES AND IT IS HEREBY AGREED BY AND BETWEEN THE PARTIES AS UNDER",
      ),
    ),
    line(
      t(
        `1. GRANT OF LICENCE: The LICENSOR hereby permits and grants licence and the LICENSEES hereby accepts to use as the said premises for the purpose of Residential use for a term of ${input.durationMonths} months on leave and licence basis. The licence period shall be deemed to have commenced from `,
      ),
      h(effectiveDate, "startDate"),
      t(" to "),
      h(endDate, "endDate"),
      t(". The LICENSEES should stay minimum of "),
      h(minStay, "minStay"),
      t(" months and after "),
      h(minStay, "minStay"),
      t(" months can vacate with "),
      h(noticeLicensee, "noticeLicensee"),
      t(" of notice period."),
    ),
    line(
      t(
        "2. SECURITY DEPOSIT: For the grant of the LICENSEES has paid on the execution of this deed an amount of ",
      ),
      h(deposit, "deposit"),
      t(
        " to the LICENSOR as a refundable security deposit towards the grant of the licence. The LICENSOR admits and acknowledges the receipt of the said amount. No Interest is paid on the said security deposit.",
      ),
    ),
    line(
      t(
        "3. LICENCE CHARGES / COMPENSATION: The LICENSEES shall pay licence charges of an amount of ",
      ),
      h(rent, "rent"),
      t(
        ` per month for the ${input.durationMonths} months for the use of the said premises. The Agreement will be renewed after ${input.durationMonths} months.`,
      ),
    ),
    line(
      t(
        `4. PAYMENT OF LICENCE CHARGES: The LICENSEES shall pay the said monthly licence in advance on or before ${rentDueDay} of each month according to english calendar and shall not commit default in paying the same. Payment shall be done through online banking.` +
          (input.rentDueDay === 5
            ? " Charges for the first and final partial calendar months shall be calculated as the monthly charge multiplied by the number of covered days, including both the commencement and end dates, divided by the actual number of days in that calendar month. If the licence commences after the first day of a month, the first payment is due five calendar days after commencement. A renewed agreement is billed separately from its own commencement date at its agreed monthly charge."
            : ""),
      ),
    ),
    line(
      t(
        "5. GAS, ELECTRICITY & WATER CHARGES: That is addition to the monthly compensation as aforesaid the LICENSEES shall pay the gas, electricity and water charges and other charges as per the reading of the meters / community to the appropriate authorities regularly, failing which the LICENSOR has every right to terminate the present agreement.",
      ),
    ),
    line(
      t(
        "6. RATES & TAXES: All the municipal taxes in respect of the said premises shall be borne and paid by the LICENSOR alone. All other levies, taxes shall be borne and paid by the LICENSOR alone.",
      ),
    ),
    line(
      t(
        "7. SUBLETTING: That the LICENSEES shall not be entitled to sublet the said premises to any other person/s or organization/s and shall use it exclusively only for residential purposes of himself or his family and friends.",
      ),
    ),
    line(
      t(
        "8. REPAIRS: The LICENSEES shall not do any act whereby the said premises or its fixtures or fittings are damaged. The LICENSEES shall maintain the premises in a proper condition and shall be liable to rectify and repair the premises in case of any damage is caused to the same due to the acts of the LICENSEES and in case the LICENSEES fails to rectify / repair the same then in such case the LICENSOR shall be entitled to claim the damages and shall deduct the damages from the amount kept as security deposit. If the damages are more than the security deposit which is kept with the LICENSOR, the LICENSOR is entitled to recover all the amount from the LICENSEES and the LICENSEES has accepted and acknowledged the same.",
      ),
    ),
    line(
      t(
        "9. PERMANENT ALTERATION: That the LICENSEES shall not be entitled to make any kind of permanent alteration or addition in the said premises except with the written prior consent of the LICENSOR.",
      ),
    ),
    line(
      t(
        "10. INSPECTION: That the LICENSOR or his authorized representative including any duly appointed property management agency shall be entitled to inspect the said premises at all reasonable time. The LICENSEES shall keep all fixtures, electric fittings, water connections in good running condition.",
      ),
    ),
    line(
      t(
        "11. BREAKAGE: That the LICENSEES shall be responsible for any breakage to the said premises or fixtures and fittings therein, occurring during the period of licence except due to ordinary climate or atmospheric wear and tear or causes beyond LICENSEES's control and natural calamities.",
      ),
    ),
    line(
      t(
        "12. TO KEEP THE PREMISES CLEAN AND TIDY: That the LICENSEES should keep the premises clean and tidy and use the premises for which purpose it is given.",
      ),
    ),
    line(
      t(
        "13. FORFEITURE: That the LICENSEES covenants with the LICENSOR that all his rights under the Licence shall be liable to be forfeited, in case of breach of any of its covenants like payment of monthly compensation, subletting of the premises etc. in which case the LICENSOR shall be entitled to resume possession of the said premises immediately.",
      ),
    ),
    line(
      t(
        "14. JUDICIAL POSSESSION: That at all times, the judicial possession of the said premises shall be of the LICENSOR. The LICENSEES has been merely granted permission to use the said premises and fixtures and fittings on leave and licence basis and the LICENSEES shall hand it over on the expiry of the stipulated period, unless it has been renewed, extended or changed mutually by and between the parties.",
      ),
    ),
    line(
      t(
        "15. LICENSEES NOT ENTITLED TO ASSIGN: The LICENSEES shall not assign, transfer, sublicence or part with the said premises or any part thereof, in any manner whatsoever, at any time during the continuance of this agreement or thereafter.",
      ),
    ),
    line(
      t(
        "16. NUISANCE & ANNOYANCE: The LICENSEES shall not do or cause to do or permit to do any act which would amount to nuisance or annoyance to the neighboring occupiers and shall not do or permit to do any immoral acts in the said premises and shall not do any act, deed or thing whereby the LICENSOR suffers any loss or damage or which may cause disturbance to the LICENSOR or to the neighboring occupiers.",
      ),
    ),
    line(
      t(
        "17. LICENSEES SHALL ABIDE BY LAW: The LICENSEES shall not do anything which is not permissible, or which is prohibited under the law or is in contravention of any bye-law, rules and regulations or any order.",
      ),
    ),
    line(
      t(
        "18. PREMISE FREE FROM ENCUMBRANCES: The LICENSOR hereby declares that the said premise is free from all encumbrances and there is no hindrance for the LICENSOR to grant this licence to LICENSEES.",
      ),
    ),
    line(
      t(
        "19. TERMINATION BY LICENSOR: Before the expiry of the period of licence, the LICENSOR is entitled to terminate the licence of the LICENSEES with ",
      ),
      h(noticeLicensor, "noticeLicensor"),
      t(
        " written notice in advance to the LICENSEES informing of his intention for vacating and termination of this agreement. On the expiry of such notice the LICENSEES shall vacate the premises and this agreement shall stand terminated. Failure to give 1 month’s notice makes LICENSOR pay 1 month’s rental.",
      ),
    ),
    line(
      t(
        "20. TERMINATION BY LICENSEES: If the LICENSEES intends to vacate or terminate the Premises before the expiry of licence period, he shall first give ",
      ),
      h(noticeLicensee, "noticeLicensee"),
      t(
        " notice in writing or over the email to the LICENSOR informing of his intention for vacating and termination of this agreement. On the expiry of such notice the LICENSEES shall vacate the premises and this agreement shall stand terminated. Failure to give ",
      ),
      h(noticeLicensee, "noticeLicensee"),
      t(" makes LICENSEES pay "),
      h(noticeLicensee, "noticeLicensee"),
      t(" rental. The LICENSEES should stay a minimum of "),
      h(minStay, "minStay"),
      t(" months and failure to stay for a minimum period makes LICENSEES pay one month rental in addition to the "),
      h(noticeLicensee, "noticeLicensee"),
      t(" notice period."),
    ),
    line(
      t(
        "21. TO VACATE: Upon termination of the licence or upon the expiry of the Licence period, the LICENSEES shall quit and vacate the said premises on or before the expiry of the period of this licence deed i.e., on or before ",
      ),
      h(endDate, "endDate"),
      t("."),
    ),
    line(
      t(
        "22. REFUND OF SECURITY DEPOSIT: The LICENSOR shall refund the 100% amount of the security deposit to the LICENSEES on vacation of the premises by the LICENSEES, subject to the deductions of any amount recoverable from the LICENSEES under this agreement. Normal wear and tear will not be the reason for deductions from the security deposit. It is further agreed that at the time of vacating the premises, an amount equivalent to one month’s rent shall/can be deducted from the security deposit for repainting charges. The balance security deposit, after the aforesaid deductions, shall be refunded by the LICENSOR to the LICENSEES within seven (7) days from the date of successful and peaceful handover of vacant possession of the said premises together with all original keys to the LICENSOR.",
      ),
    ),
    line(
      t(
        "23. REMEDY AGAINST THE LICENSEES: If the LICENSEES fails to quit and vacate the said premises to the owner then in that case the LICENSOR shall be entitled to forfeit the security deposit amount and proceed to recover possession from the licence in the court.",
      ),
    ),
    line(
      t(
        "24. NO CLAIM OF TENANCY: It is clearly understood between the parties to this deed that no relationship of landlord and tenant exists between them and that the LICENSOR has not granted tenancy rights in the said premises to the LICENSEES by this deed. The LICENSEES shall not make any claim of tenancy in the said premises.",
      ),
    ),
    line(
      t(
        "25. PARTNERSHIP: Nothing herein contained shall constitute a partnership or a joint venture or any other relationship between the parties except that of the LICENSOR and LICENSEES.",
      ),
    ),
    line(
      t(
        "26. RIGHT TO VACATE: Only after the termination of the agreement or upon expiry of the licence period, the LICENSEES shall not be entitled to enter upon the said premises, except for removing his belongings etc. and the LICENSOR shall be entitled to a free and unobstructed access to the said premises, including the right of breaking open of the locks etc. and removing the belongings/articles/persons etc. of the LICENSEES from the said premises and vacate the premises and it shall be deemed as if the LICENSOR has been specifically irrevocably empowered, authorized and consented by the LICENSEES to remove the properties etc. from The said premises and take possession. All the costs of such vacation shall be recoverable by the LICENSOR and till the said costs are paid the LICENSOR shall have a lien on the Property/belonging etc. as may have been removed from the said premises.",
      ),
    ),
    line(
      t(
        "27. ADDRESS FOR COMMUNICATION: That any communication made by and between parties at the address mentioned above shall deemed to have been duly received in due course of time. In addition to physical delivery, communication and notices may also be validly served through electronic means, including but not limited to the official email addresses of the Parties, or through instant messaging applications such as WhatsApp, and such communication shall be deemed to have been duly received when transmitted, unless proven otherwise.",
      ),
    ),
    line(
      t(
        "28. NO WAIVER: It is agreed that any indulgence shown or any delay on the part of LICENSOR to evict the LICENSEES or non-action of the LICENSOR against the LICENSEES for the non-observance of the terms or breach of the terms of this deed shall not be construed as waiver or surrender of any rights of the LICENSOR and shall not prejudice the rights of the LICENSOR.",
      ),
    ),
    line(
      t(
        "29. FREE CONSENT: The LICENSEES has duly executed this agreement after clearly understanding the implications and consequences of the agreement and they have signed hereunder by their free will and free consent.",
      ),
    ),
    line(
      t(
        "30. THEFTS OR LOSS: LICENSOR shall not be responsible or liable for any theft or loss, damage of property of LICENSEES neither any bodily injury to any reason in licenced premises.",
      ),
    ),
    line(
      t(
        "31. The parties hereto have executed this licence on Non Judicial stamp paper the original licence shall remain with LICENSOR & copy thereof with LICENSEES.",
      ),
    ),
    line(
      t(
        "32. The house needs to be cleaned by the LICENSEES at his cost at the time of vacating the apartment.",
      ),
    ),
    line(
      t(
        "33. The advance deposit will be refunded to the LICENSEES only after the LICENSEES returns all the original keys given to him at the time of moving in, and after deducting any repair charges.",
      ),
    ),
    line(
      t(
        "34. The LICENSEES will ensure all the fittings and fixtures (lights, fans, geysers, shelves, cabinets, taps, all furniture / fixtures etc.) in the house are in a proper working condition during his stay and until he vacates the property.",
      ),
    ),
    line(
      t(
        "The LICENSEES should pay the move in / Move out charges to the society, as per the society regulations if there any.",
      ),
    ),
    line(
      t(
        `IN WITNESS, WHEREOF THE PARTIES TO THIS DEED HAVE SIGNED HERE UNDER ON THE AFORESAID DATE AT ${input.executionCity.toUpperCase()}.`,
      ),
    ),
    line(t("LICENSOR:")),
  ];

  for (const party of owners) {
    lines.push(line(t("Name: "), h(party.name, "partyName")));
    lines.push(line(t(`Email: ${party.email?.trim() || "-"}`)));
  }

  lines.push(line(t("LICENSEES:")));
  for (const party of tenants) {
    lines.push(line(t("Name: "), h(party.name, "partyName")));
    lines.push(line(t(`Email: ${party.email?.trim() || "-"}`)));
  }

  lines.push(line(t("ANNEXURE - 1")));
  lines.push(line(t("DESCRIPTION OF THE SAID PREMISES:")));
  lines.push(line(t(`All that consisting of premises, at ${input.propertyAddress}.`)));
  lines.push(...annexureLines(input.inventoryItems));

  return { lines };
}

export function generateLeaseAgreementText(input: LeaseAgreementPdfInput): string {
  return flattenLeaseAgreementDocument(generateLeaseAgreementDocument(input));
}

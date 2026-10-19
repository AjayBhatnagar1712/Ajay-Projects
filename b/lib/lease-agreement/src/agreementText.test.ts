import { describe, expect, it } from "vitest";
import {
  flattenLeaseAgreementDocument,
  generateLeaseAgreementDocument,
  generateLeaseAgreementText,
} from "./agreementText.js";
import { formatInrPaise } from "./format.js";
import type { LeaseAgreementPdfInput } from "./types.js";

const fixture: LeaseAgreementPdfInput = {
  executionDate: "2026-06-27",
  effectiveDate: "2026-07-01",
  endDate: "2027-06-01",
  executionCity: "Hyderabad",
  durationMonths: 11,
  minStayMonths: 3,
  noticePeriodLicenseeMonths: 2,
  noticePeriodLicensorMonths: 2,
  monthlyRentPaise: 7_789_600,
  securityDepositPaise: 14_000_000,
  rentDueDay: 5,
  propertyAddress:
    "TOWER-10, FLAT NO-10141, PRESTIGE HIGH FIELD'S, Near Continental Hospital, ISB Road, Financial District, Nanakramguda, Hyderabad, Telangana - 500032",
  areaSqft: 1742,
  facing: "West",
  carParkingCount: 1,
  parties: [
    {
      role: "owner",
      title: "Mr.",
      name: "KRISHNA BHARGAV JUTURU",
      age: 36,
      address:
        "1-2-25 FLAT NO-204, GAGAN MAHAL, NAGILLAS SRI RANGA NILAYAM, DOMALGUDA, HYDERABAD, TELANGANA - 500029.",
      aadhaar: "9671 3280 7649",
      pan: "ANZPJ9269Q",
      email: "krishnabhargavj@gmail.com",
      isPrimary: true,
      sortOrder: 0,
    },
    {
      role: "tenant",
      title: "Mr.",
      name: "V Vijayakrishnan",
      age: 25,
      address:
        "3, Vallalar Street, Periyar Nagar, Kathirkamam, Pondicherry Pondicherry - 605009",
      aadhaar: "5843 5053 8806",
      pan: null,
      email: "krishnanvijay2000@gmail.com",
      isPrimary: true,
      sortOrder: 1,
    },
  ],
  inventoryItems: [
    {
      description: "Daikin Air Conditioners in the flat.",
      quantity: 4,
      sortOrder: 0,
    },
    {
      description: "Calling bell.",
      quantity: 1,
      sortOrder: 1,
    },
  ],
};

describe("formatInrPaise", () => {
  it("formats rupee amounts in Aman's style", () => {
    expect(formatInrPaise(14_000_000)).toBe(
      "Rs.1,40,000/- (RUPEES ONE LAKH FORTY THOUSAND ONLY)",
    );
  });
});

describe("generateLeaseAgreementDocument", () => {
  it("states the calendar proration and first-payment exception", () => {
    const text = generateLeaseAgreementText({ ...fixture, effectiveDate: "2026-09-10", endDate: "2027-08-10" });
    expect(text).toContain("on or before 5th");
    expect(text).toContain("including both the commencement and end dates");
    expect(text).toContain("actual number of days in that calendar month");
    expect(text).toContain("first payment is due five calendar days after commencement");
  });
  it("flattens to the same string as generateLeaseAgreementText", () => {
    const document = generateLeaseAgreementDocument(fixture);
    expect(flattenLeaseAgreementDocument(document)).toBe(
      generateLeaseAgreementText(fixture),
    );
  });

  it("marks rent, deposit, dates, notices, min stay, and party names", () => {
    const document = generateLeaseAgreementDocument(fixture);
    const kinds = new Set(
      document.lines.flatMap((line) =>
        line.runs.filter((run) => run.highlight).map((run) => run.highlight),
      ),
    );
    expect(kinds).toEqual(
      new Set([
        "rent",
        "deposit",
        "startDate",
        "endDate",
        "noticeLicensee",
        "noticeLicensor",
        "minStay",
        "partyName",
      ]),
    );
    const highlighted = document.lines
      .flatMap((line) => line.runs)
      .filter((run) => run.highlight);
    expect(highlighted.some((run) => run.text.includes("KRISHNA"))).toBe(true);
    expect(highlighted.some((run) => run.highlight === "rent")).toBe(true);
    // Clause titles themselves are not highlight spans
    expect(
      highlighted.every(
        (run) => !/^(GRANT OF LICENCE|SECURITY DEPOSIT|LICENCE CHARGES)/.test(run.text),
      ),
    ).toBe(true);
  });
});

describe("generateLeaseAgreementText", () => {
  it("renders Aman-style party blocks and annexure Description|Quantity table", () => {
    const text = generateLeaseAgreementText(fixture);

    expect(text).toContain("LEAVE & LICENCE AGREEMENT");
    expect(text).toContain(
      "Mr. KRISHNA BHARGAV JUTURU, AGED ABOUT 36 YEARS R/O :- 1-2-25 FLAT NO-204, GAGAN MAHAL, NAGILLAS SRI RANGA NILAYAM, DOMALGUDA, HYDERABAD, TELANGANA - 500029.",
    );
    expect(text).toContain(
      "# AADHAR NUMBER :- 9671 3280 7649 PAN NUMBER :- ANZPJ9269Q",
    );
    expect(text).toContain(
      "Mr. V Vijayakrishnan, AGED ABOUT 25 YEARS R/O :- 3, Vallalar Street, Periyar Nagar, Kathirkamam, Pondicherry Pondicherry - 605009",
    );
    expect(text).toContain("# AADHAR NUMBER :- 5843 5053 8806");
    expect(text).not.toContain("PAN NUMBER :- null");
    expect(text).toContain(
      "located at TOWER-10, FLAT NO-10141, WEST FACING, along with 1 Car Parking in PRESTIGE HIGH FIELD'S, Near Continental Hospital, ISB Road, Financial District, Nanakramguda, Hyderabad, Telangana - 500032.",
    );
    expect(text).toContain(
      "2. SECURITY DEPOSIT: For the grant of the LICENSEES has paid on the execution of this deed an amount of Rs.1,40,000/- (RUPEES ONE LAKH FORTY THOUSAND ONLY)",
    );
    expect(text).toContain(
      "3. LICENCE CHARGES / COMPENSATION: The LICENSEES shall pay licence charges of an amount of Rs.77,896/- (RUPEES SEVENTY SEVEN THOUSAND EIGHT HUNDRED NINETY SIX ONLY)",
    );
    expect(text).toContain("ANNEXURE - 1");
    expect(text).toContain("Description | Quantity");
    expect(text).toContain("Daikin Air Conditioners in the flat. | 4");
    expect(text).toContain("Calling bell. | 1");
    expect(text).toContain(
      "*All Amenities are in good working condition as mentioned above.",
    );
  });
});

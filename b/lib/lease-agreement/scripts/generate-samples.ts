import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateLeaseAgreementPdf,
  type LeaseAgreementPdfInput,
} from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(__dirname, "..", "samples");

const maxCase: LeaseAgreementPdfInput = {
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
      role: "owner",
      title: "Ms.",
      name: "ESIKELA SHRUTHI",
      age: 32,
      address:
        "1-2-25 FLAT NO- 204, GAGAN MAHAL, NAGILLAS SRI RANGA NILAYAM, DOMALGUDA, HYDERABAD, TELANGANA - 500029.",
      aadhaar: "6182 5740 5356",
      pan: "ABIPE3628H",
      email: "evshruthi@gmail.com",
      isPrimary: false,
      sortOrder: 1,
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
      sortOrder: 2,
    },
    {
      role: "tenant",
      title: "Mr.",
      name: "SOHAM SHREERAM LAKHOTE",
      age: 28,
      address:
        "402, Rejoice, City Of Joy, J.S.D. Road, Near Lok Everest, Mulund (West), Mumbai, Maharashtra - 400080",
      aadhaar: "3870 4422 1390",
      pan: null,
      email: "sohamlakhote141@gmail.com",
      isPrimary: false,
      sortOrder: 3,
    },
    {
      role: "tenant",
      title: "Mr.",
      name: "ABHIJEET KUMAR",
      age: 22,
      address:
        "Main Road, Ramalayam Prakkana, Pothureddypalli, Nuzvid Mandalam, Pathureddipalle, Pothureddipalli, Nuzvid, Krishna, Andhra Pradesh - 521201",
      aadhaar: "9194 5611 5604",
      pan: null,
      email: "abhijeet.kumar.winner@gmail.com",
      isPrimary: false,
      sortOrder: 4,
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
    {
      description: "Chimney.",
      quantity: 1,
      sortOrder: 2,
    },
    {
      description: "Clothes Drying Hanger in Balcony.",
      quantity: 1,
      sortOrder: 3,
    },
    {
      description: "Geysers.",
      quantity: 3,
      sortOrder: 4,
    },
    {
      description: "Wardrobes in the flat.",
      quantity: 1,
      sortOrder: 5,
    },
    {
      description: "Fans & Lights in the flat.",
      quantity: 1,
      sortOrder: 6,
    },
    {
      description: "Shoe Rack.",
      quantity: 1,
      sortOrder: 7,
    },
    {
      description: "Mirrors",
      quantity: 1,
      sortOrder: 8,
    },
    {
      description: "Bed Cots",
      quantity: 3,
      sortOrder: 9,
    },
    {
      description: "Pigeon Stove",
      quantity: 1,
      sortOrder: 10,
    },
  ],
};

const minimalCase: LeaseAgreementPdfInput = {
  executionDate: "2026-09-15",
  effectiveDate: "2026-10-01",
  endDate: "2027-08-31",
  executionCity: "Pune",
  durationMonths: 11,
  minStayMonths: 6,
  noticePeriodLicenseeMonths: 1,
  noticePeriodLicensorMonths: 1,
  monthlyRentPaise: 2_800_000,
  securityDepositPaise: 8_400_000,
  rentDueDay: 1,
  propertyAddress: "Flat 3, Lakeview Heights, Baner, Pune, Maharashtra - 411045",
  areaSqft: 640,
  facing: "East",
  carParkingCount: 0,
  parties: [
    {
      role: "owner",
      title: "Mr.",
      name: "Suresh Iyer",
      age: 54,
      address: "10 Green Park, Aundh, Pune, Maharashtra - 411007",
      aadhaar: "1234 5678 9012",
      pan: "AAAPI1234K",
      email: "suresh.iyer@example.com",
      isPrimary: true,
      sortOrder: 0,
    },
    {
      role: "tenant",
      title: "Ms.",
      name: "Priya Nair",
      age: 29,
      address: "Flat 2B, Riverstone Apartments, Baner, Pune, Maharashtra - 411045",
      aadhaar: "9876 5432 1098",
      pan: null,
      email: "priya.nair@example.com",
      isPrimary: true,
      sortOrder: 1,
    },
  ],
  inventoryItems: [
    {
      description: "Ceiling fan.",
      quantity: 1,
      sortOrder: 0,
    },
    {
      description: "Geyser.",
      quantity: 1,
      sortOrder: 1,
    },
  ],
};

async function writeSample(
  filename: string,
  input: LeaseAgreementPdfInput,
): Promise<void> {
  const { bytes, pageCount } = await generateLeaseAgreementPdf(input);
  const outPath = path.join(samplesDir, filename);
  await writeFile(outPath, bytes);
  console.log(`${outPath} (${pageCount} pages, ${bytes.byteLength} bytes)`);
}

await mkdir(samplesDir, { recursive: true });
await writeSample("lease-agreement-max-5-parties.pdf", maxCase);
await writeSample("lease-agreement-minimal-2-parties.pdf", minimalCase);

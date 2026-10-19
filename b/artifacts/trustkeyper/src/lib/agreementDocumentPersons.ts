import type { AgreementPersonDraftState } from "./agreementWorkflowDraft";

export interface AgreementPartyInput {
  name: string;
  contact: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function isOwnerLabel(label: string): boolean {
  return label.startsWith("OWNER");
}

function buildPersonLabel(index: number, ownerCount: number): string {
  if (index < ownerCount) {
    return ownerCount === 1 ? "OWNER" : `OWNER ${index + 1}`;
  }
  return `TENANT ${index - ownerCount + 1}`;
}

function createPerson(name: string, contact: string, personLabel: string): AgreementPersonDraftState {
  return {
    name,
    contact,
    personLabel,
    docs: [
      { id: "aadhaar", label: "Aadhaar Card", status: "pending" },
      { id: "pan", label: "PAN Card", status: "pending" },
      { id: "bank", label: "Bank Account Details", status: "pending" },
    ],
  };
}

function sameIdentity(
  person: AgreementPersonDraftState,
  party: AgreementPartyInput,
): boolean {
  const personPhone = normalizePhone(person.contact);
  const partyPhone = normalizePhone(party.contact);
  if (personPhone && partyPhone) return personPhone === partyPhone;

  const personName = normalizeName(person.name);
  const partyName = normalizeName(party.name);
  return Boolean(personName && partyName && personName === partyName);
}

function clonePerson(person: AgreementPersonDraftState): AgreementPersonDraftState {
  return {
    ...person,
    docs: person.docs.map((doc) => ({ ...doc })),
  };
}

export function reconcileAgreementDocumentPersons(
  existing: AgreementPersonDraftState[],
  allParties: AgreementPartyInput[],
  ownerCount: number,
): AgreementPersonDraftState[] {
  if (allParties.length === 0) return [];

  const pool = existing.map((person, index) => ({
    index,
    person: clonePerson(person),
    role: isOwnerLabel(person.personLabel) ? "owner" : "tenant",
  }));
  const used = new Set<number>();

  const takeMatch = (
    role: "owner" | "tenant",
    party: AgreementPartyInput,
    label: string,
  ): AgreementPersonDraftState | null => {
    const strategies = [
      (entry: (typeof pool)[number]) => entry.person.personLabel === label && sameIdentity(entry.person, party),
      (entry: (typeof pool)[number]) => entry.role === role && sameIdentity(entry.person, party),
      (entry: (typeof pool)[number]) => entry.person.personLabel === label,
    ];

    for (const matches of strategies) {
      const hit = pool.find((entry) => !used.has(entry.index) && matches(entry));
      if (hit) {
        used.add(hit.index);
        return hit.person;
      }
    }
    return null;
  };

  return allParties.map((party, index) => {
    const label = buildPersonLabel(index, ownerCount);
    const role = index < ownerCount ? "owner" : "tenant";
    const match = takeMatch(role, party, label);
    const base = match ?? createPerson(party.name, party.contact, label);

    return {
      ...base,
      name: party.name,
      contact: party.contact,
      personLabel: label,
    };
  });
}

export function areAgreementDocumentsComplete(persons: AgreementPersonDraftState[]): boolean {
  return (
    persons.length > 0 &&
    persons.every((person) => person.docs.every((doc) => doc.status === "uploaded"))
  );
}

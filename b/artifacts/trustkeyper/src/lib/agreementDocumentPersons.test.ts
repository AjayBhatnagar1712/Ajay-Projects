import { describe, expect, it } from "vitest";
import {
  areAgreementDocumentsComplete,
  reconcileAgreementDocumentPersons,
  type AgreementPartyInput,
} from "./agreementDocumentPersons";
import type { AgreementPersonDraftState } from "./agreementWorkflowDraft";

describe("agreementDocumentPersons", () => {
  it("preserves existing uploads and adds pending docs for newly added parties", () => {
    const existing: AgreementPersonDraftState[] = [
      {
        name: "Broker Self",
        contact: "+919900001111",
        personLabel: "OWNER",
        docs: [
          { id: "aadhaar", label: "Aadhaar Card", status: "uploaded", fileName: "broker-aadhaar.pdf" },
          { id: "pan", label: "PAN Card", status: "uploaded", fileName: "broker-pan.pdf" },
          { id: "bank", label: "Bank Account Details", status: "uploaded", fileName: "Bank Account" },
        ],
      },
      {
        name: "Tenant One",
        contact: "+919811112222",
        personLabel: "TENANT 1",
        documentUploadToken: "adu_tenant_one",
        docs: [
          { id: "aadhaar", label: "Aadhaar Card", status: "link_sent" },
          { id: "pan", label: "PAN Card", status: "link_sent" },
          { id: "bank", label: "Bank Account Details", status: "link_sent" },
        ],
      },
    ];

    const parties: AgreementPartyInput[] = [
      { name: "Broker Self", contact: "+919900001111" },
      { name: "Owner Two", contact: "+919822223333" },
      { name: "Tenant One", contact: "+919811112222" },
      { name: "Tenant Two", contact: "+919833334444" },
    ];

    const reconciled = reconcileAgreementDocumentPersons(existing, parties, 2);

    expect(reconciled).toHaveLength(4);
    expect(reconciled[0]?.personLabel).toBe("OWNER 1");
    expect(reconciled[0]?.docs[0]?.fileName).toBe("broker-aadhaar.pdf");
    expect(reconciled[1]?.personLabel).toBe("OWNER 2");
    expect(reconciled[1]?.docs.every((doc) => doc.status === "pending")).toBe(true);
    expect(reconciled[2]?.personLabel).toBe("TENANT 1");
    expect(reconciled[2]?.documentUploadToken).toBe("adu_tenant_one");
    expect(reconciled[2]?.docs[0]?.status).toBe("link_sent");
    expect(reconciled[3]?.personLabel).toBe("TENANT 2");
    expect(reconciled[3]?.docs.every((doc) => doc.status === "pending")).toBe(true);
  });

  it("marks document completeness only when every person is fully covered", () => {
    const partial: AgreementPersonDraftState[] = [
      {
        name: "Owner",
        contact: "+919999999999",
        personLabel: "OWNER",
        docs: [
          { id: "aadhaar", label: "Aadhaar Card", status: "uploaded" },
          { id: "pan", label: "PAN Card", status: "pending" },
          { id: "bank", label: "Bank Account Details", status: "uploaded" },
        ],
      },
    ];
    const complete = [
      {
        ...partial[0],
        docs: partial[0]!.docs.map((doc) => ({ ...doc, status: "uploaded" as const })),
      },
    ];

    expect(areAgreementDocumentsComplete([])).toBe(false);
    expect(areAgreementDocumentsComplete(partial)).toBe(false);
    expect(areAgreementDocumentsComplete(complete)).toBe(true);
  });

  it("treats link_sent tenant docs as incomplete", () => {
    const linkSentTenant: AgreementPersonDraftState[] = [
      {
        name: "Tenant One",
        contact: "+919811112222",
        personLabel: "TENANT 1",
        docs: [
          { id: "aadhaar", label: "Aadhaar Card", status: "link_sent" },
          { id: "pan", label: "PAN Card", status: "link_sent" },
          { id: "bank", label: "Bank Account Details", status: "link_sent" },
        ],
      },
    ];

    expect(areAgreementDocumentsComplete(linkSentTenant)).toBe(false);
  });
});

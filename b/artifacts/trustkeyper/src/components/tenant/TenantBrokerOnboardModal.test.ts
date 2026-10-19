import { describe, expect, it } from "vitest";
import { resolveTenantOnboardModalCopy } from "./TenantBrokerOnboardModal";

describe("resolveTenantOnboardModalCopy", () => {
  it("uses broker onboarding copy by default", () => {
    const copy = resolveTenantOnboardModalCopy({ flowContext: "broker_onboard" });
    expect(copy.welcomeTitle).toBe("Welcome to TrustKeyper");
    expect(copy.successDescription).toContain("rental preferences");
  });

  it("uses document upload copy with requester and property context", () => {
    const copy = resolveTenantOnboardModalCopy({
      flowContext: "document_upload",
      requesterName: "Ravi Broker",
      propertyLabel: "Prestige Unit 1806",
    });
    expect(copy.welcomeTitle).toBe("Upload your documents");
    expect(copy.welcomeDescription).toContain("Ravi Broker");
    expect(copy.welcomeDescription).toContain("Prestige Unit 1806");
    expect(copy.successDescription).toContain("upload the documents");
    expect(copy.successDescription).not.toContain("rental preferences");
  });
});

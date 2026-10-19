import React from "react";
import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";
import { CONTACT } from "@/lib/marketingConstants";

export function DeleteAccountPage() {
  return (
    <LegalPageLayout title="How to delete your TrustKeyper account">
      <p>
        You can request deletion of your TrustKeyper account at any time. This page explains how to
        submit a request and what happens to your data afterward.
      </p>

      <h2>How to request deletion</h2>
      <ol>
        <li>
          Email{" "}
          <a href={CONTACT.emailHref} className="text-marketing-blue underline">
            {CONTACT.email}
          </a>{" "}
          from your registered email address, <strong>or</strong> message us with your registered
          phone number, requesting account deletion.
        </li>
        <li>
          Include enough detail for us to identify your account (registered email and/or phone
          number).
        </li>
        <li>We will process your request and confirm once it is complete.</li>
      </ol>

      <h2>What is deleted</h2>
      <p>
        Your broker profile — name, email, and onboarding details — is deleted or anonymized within{" "}
        <strong>30 days</strong> of your request, and permanently erased within{" "}
        <strong>1.5 years</strong>.
      </p>

      <h2>What is retained and why</h2>
      <p>
        Lease agreements you created remain on file for up to <strong>5 years</strong>, since they
        contain information relevant to other parties (property owners and tenants) and may be
        required for legal, financial, or audit purposes. Retained agreement data no longer displays
        your personal profile information once your account is deleted.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this process? Email{" "}
        <a href={CONTACT.emailHref} className="text-marketing-blue underline">
          {CONTACT.email}
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}

import React from "react";
import { Link } from "wouter";
import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";
import { CONTACT } from "@/lib/marketingConstants";

export function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <p>
        Trustkeyper (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) respects your privacy and is
        committed to protecting your personal information. This Privacy Policy explains how we
        collect, use, disclose, and safeguard your information when you visit our website or use our
        property management services.
      </p>

      <h2>Information We Collect</h2>
      <p>We may collect the following types of information:</p>
      <ul>
        <li>
          <strong>Personal identification information</strong> — name, phone number, email address,
          and mailing address.
        </li>
        <li>
          <strong>Property information</strong> — property address, ownership documents, rental
          terms, and maintenance records.
        </li>
        <li>
          <strong>Financial information</strong> — bank account details, UPI information, rent
          payment records, and billing history necessary to facilitate property management services.
        </li>
        <li>
          <strong>Technical information</strong> — IP address, browser type, device information,
          and usage data collected through cookies and similar technologies when you use our
          website.
        </li>
        <li>
          <strong>Communications</strong> — records of correspondence with our team, including
          emails, phone calls, and messages via our platform.
        </li>
      </ul>

      <h2>How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, operate, and maintain our property management services.</li>
        <li>Process rent collection, payouts, and financial reporting.</li>
        <li>Facilitate tenant acquisition, screening, and lease management.</li>
        <li>Coordinate property maintenance and inspections.</li>
        <li>Communicate with you about your account, properties, and services.</li>
        <li>Improve our website, platform, and customer experience.</li>
        <li>Comply with legal obligations and enforce our Terms &amp; Conditions.</li>
      </ul>

      <h2>Sharing of Information</h2>
      <p>We do not sell your personal information. We may share information with:</p>
      <ul>
        <li>
          Service providers who assist us in operating our platform (e.g. payment processors, SMS
          providers, cloud hosting).
        </li>
        <li>Tenants, vendors, or authorities as necessary to manage your property.</li>
        <li>Legal or regulatory authorities when required by law.</li>
      </ul>

      <h2>Data Security</h2>
      <p>
        We implement appropriate technical and organizational measures to protect your personal
        information against unauthorized access, alteration, disclosure, or destruction. However, no
        method of transmission over the internet is completely secure, and we cannot guarantee
        absolute security.
      </p>

      <h2>Data Retention</h2>
      <p>
        We retain your personal information for as long as necessary to provide our services,
        comply with legal obligations, resolve disputes, and enforce our agreements.
      </p>

      <h2>Your Rights</h2>
      <p>Depending on applicable law, you may have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you.</li>
        <li>Request correction of inaccurate information.</li>
        <li>
          Request deletion of your information, subject to legal requirements. See{" "}
          <Link href="/delete-account" className="text-marketing-blue underline">
            How to delete your TrustKeyper account
          </Link>{" "}
          for steps, timelines, and what we retain.
        </li>
        <li>Withdraw consent where processing is based on consent.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Our website may use cookies and similar tracking technologies to enhance your browsing
        experience and analyze site traffic. You can control cookie preferences through your browser
        settings.
      </p>

      <h2>Third-Party Links</h2>
      <p>
        Our website may contain links to third-party websites. We are not responsible for the
        privacy practices of those sites and encourage you to review their privacy policies.
      </p>

      <h2>Children&apos;s Privacy</h2>
      <p>
        Our services are not directed to individuals under the age of 18. We do not knowingly collect
        personal information from children.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Changes will be posted on this page
        with an updated effective date. Continued use of our services after changes constitutes
        acceptance of the updated policy.
      </p>

      <h2>Contact Us</h2>
      <p>If you have questions about this Privacy Policy, please contact us:</p>
      <ul>
        <li>Email: {CONTACT.email}</li>
        <li>Phone: {CONTACT.phone}</li>
        <li>Website: www.trustkeyper.com</li>
      </ul>

      <p>
        Registered name: Paravent. GST number: 09AKVPM7660B1ZP.
      </p>
    </LegalPageLayout>
  );
}

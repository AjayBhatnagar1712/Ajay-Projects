import React from "react";
import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";
import { CONTACT } from "@/lib/marketingConstants";

export function TermsPage() {
  return (
    <LegalPageLayout title="Terms & Conditions">
      <p>
        Welcome to Trustkeyper. These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of
        our website and services. By accessing or using our services, you agree to comply with and
        be bound by these Terms. Please review these Terms carefully.
      </p>

      <h2>Definitions</h2>
      <ul>
        <li>
          &quot;Trustkeyper&quot; refers to the property management services provided by our firm.
        </li>
        <li>
          &quot;Owner&quot; means the property owner who appoints Trustkeyper as their property
          manager.
        </li>
        <li>
          &quot;Tenant&quot; refers to the individual(s) who occupy the property under a rental
          agreement facilitated by Trustkeyper.
        </li>
        <li>
          &quot;Services&quot; refer to the management, tenant acquisition, rental collection,
          maintenance coordination, and other property-related services provided by Trustkeyper.
        </li>
      </ul>

      <h2>Registered name and GST number</h2>
      <p>
        The registered name of the firm is Paravent and the GST number is 09AKVPM7660B1ZP. All
        agreements will be made with the registered firm&apos;s name, Paravent.
      </p>

      <h2>Scope of Services</h2>
      <p>Trustkeyper offers comprehensive property management services, including:</p>
      <ul>
        <li>Tenant acquisition and screening</li>
        <li>Lease and rent management</li>
        <li>Property maintenance and repair coordination</li>
        <li>Transparent financial reporting</li>
        <li>Handling of vacancies and tenant turnover</li>
        <li>Coordination of statutory payments</li>
        <li>Regular property inspections and reporting</li>
        <li>Dedicated Property Manager for communication and coordination</li>
      </ul>

      <h2>Responsibilities of the Owner</h2>
      <p>The Owner agrees to:</p>
      <ul>
        <li>Provide accurate and complete information about the property.</li>
        <li>Bear the actual costs of repairs and maintenance.</li>
        <li>
          Authorize Trustkeyper to manage the property and interact with tenants, vendors, and
          relevant authorities.
        </li>
        <li>Ensure compliance with all applicable laws, including taxation.</li>
      </ul>

      <h2>Responsibilities of Trustkeyper</h2>
      <p>Trustkeyper agrees to:</p>
      <ul>
        <li>Ensure timely rent collection and payouts to the Owner.</li>
        <li>Conduct professional tenant verification and screening.</li>
        <li>Manage property maintenance and repairs efficiently.</li>
        <li>Provide detailed financial reporting and a transparent dashboard for monitoring.</li>
        <li>Facilitate all formalities related to tenant move-in and move-out.</li>
      </ul>

      <h2>Financial Terms</h2>
      <ul>
        <li>
          Trustkeyper and the Owner shall agree upon a fixed monthly rent and a security deposit
          equivalent to two months&apos; rent.
        </li>
        <li>
          Trustkeyper will deduct its management fee from the rent collected and transfer the
          remaining amount to the Owner by the 7th of each month.
        </li>
        <li>
          Any repair or maintenance costs incurred will be deducted from the rent or billed
          separately, as mutually agreed.
        </li>
      </ul>

      <h2>Security Deposit and Payments</h2>
      <ul>
        <li>Tenants shall pay a security deposit equivalent to three months&apos; rent.</li>
        <li>
          Security deposits will be returned to tenants within 24 hours of vacating the property,
          minus any applicable deductions for damages or outstanding charges.
        </li>
        <li>Rent must be paid by tenants before the 2nd day of each month.</li>
      </ul>

      <h2>Maintenance and Repairs</h2>
      <ul>
        <li>Trustkeyper will coordinate maintenance and repair activities.</li>
        <li>
          The Owner is responsible for the actual costs associated with maintenance, repairs, and
          any property upgrades, which will be transparently communicated.
        </li>
      </ul>

      <h2>Termination</h2>
      <ul>
        <li>
          This agreement shall initially be valid for an 11-month period, with renewal subject to
          mutual consent.
        </li>
        <li>Either party may terminate the agreement with written notice of at least 45 days.</li>
      </ul>

      <h2>Indemnity</h2>
      <p>
        Both the Owner and Trustkeyper agree to indemnify and hold each other harmless against any
        claims, liabilities, losses, damages, costs, and expenses arising from their respective
        obligations or breaches under these Terms.
      </p>

      <h2>Governing Law and Jurisdiction</h2>
      <p>
        These Terms shall be governed by the laws of India, specifically the courts in Hyderabad,
        Telangana, which shall have exclusive jurisdiction.
      </p>

      <h2>Dispute Resolution</h2>
      <p>
        In case of any disputes arising from or relating to these Terms, parties agree to first seek
        resolution through mutual discussions. If unresolved, disputes will be settled through
        arbitration in Hyderabad, in accordance with the Arbitration and Conciliation Act, 1996.
      </p>

      <h2>Changes to Terms &amp; Conditions</h2>
      <p>
        Trustkeyper reserves the right to modify these Terms at any time. Any changes will be
        communicated via email or updated on our website. Continued use of our services constitutes
        acceptance of the updated Terms.
      </p>

      <h2>Contact Information</h2>
      <p>For any queries regarding these Terms, please contact:</p>
      <ul>
        <li>Email: {CONTACT.email}</li>
        <li>Phone: {CONTACT.phone}</li>
        <li>Website: www.trustkeyper.com</li>
      </ul>

      <p>
        By using Trustkeyper services, you acknowledge that you have read, understood, and agreed to
        abide by these Terms &amp; Conditions.
      </p>
    </LegalPageLayout>
  );
}

import React from "react";
import { LegalPageLayout } from "@/components/marketing/LegalPageLayout";
import { CONTACT } from "@/lib/marketingConstants";

const FAQ_ITEMS = [
  {
    question: "What is the registered name and GST number of the firm?",
    answer:
      "The registered name of the firm is Paravent and the GST number is 09AKVPM7660B1ZP. All agreements will be made with the registered firm's name, Paravent.",
  },
  {
    question: "What services does Trustkeyper offer?",
    answer:
      "Trustkeyper provides comprehensive property management services including tenant acquisition, background verification, rent collection, lease management, regular property inspections, maintenance coordination, financial reporting, and dispute resolution.",
  },
  {
    question: "Who will be my primary contact for queries?",
    answer:
      "Each client is assigned a dedicated Property Manager who serves as your single point of contact for all your property-related needs.",
  },
  {
    question: "How do you ensure reliable tenants?",
    answer:
      "We conduct rigorous tenant screening including background checks, employment verification, credit history, and past rental behavior to ensure reliable and trustworthy tenants.",
  },
  {
    question: "What happens if the property remains vacant?",
    answer:
      "If your property is vacant, Trustkeyper will proactively market it to ensure it gets occupied quickly. However, during the vacancy period, no rent payment will be made to the owner.",
  },
  {
    question: "How is maintenance managed?",
    answer:
      "All property maintenance and repair needs are coordinated by Trustkeyper. Maintenance costs are borne by the owner, and charges are transparently communicated and billed at actuals.",
  },
  {
    question: "How and when will I receive my rental payments?",
    answer:
      "Rent is collected by the 2nd of each month. After deducting our management fees and any maintenance costs, the balance is transferred to your designated Indian bank account by the 7th of each month.",
  },
  {
    question: "What is the duration of the Property Management Agreement?",
    answer:
      "Our agreements typically run for an initial period of 11 months, with an option to renew upon mutual agreement.",
  },
  {
    question: "Who handles tenant eviction if needed?",
    answer:
      "Trustkeyper manages the complete eviction process in accordance with legal procedures, ensuring minimal hassle for property owners.",
  },
  {
    question: "How transparent is the financial reporting?",
    answer:
      "We provide owners with a transparent and user-friendly online dashboard that includes detailed financial statements, rent receipts, maintenance invoices, and other transaction details.",
  },
  {
    question: "Can I monitor my property remotely?",
    answer:
      "Yes, our digital platform allows you to remotely monitor your property's financials, tenant details, and maintenance activities in real-time.",
  },
] as const;

export function FaqsPage() {
  return (
    <LegalPageLayout title="Frequently Asked Questions (FAQs)">
      {FAQ_ITEMS.map((item) => (
        <div key={item.question} className="mb-8">
          <h2>{item.question}</h2>
          <p>{item.answer}</p>
        </div>
      ))}

      <h2>Contact Information</h2>
      <ul>
        <li>Email: {CONTACT.email}</li>
        <li>Phone: {CONTACT.phone}</li>
        <li>Website: www.trustkeyper.com</li>
      </ul>
    </LegalPageLayout>
  );
}

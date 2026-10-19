import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Does TrustKeyper collect or hold rent?",
    answer:
      "We collect rent but never hold it. It goes directly to Owner's account. Payments are made on the TrustKeyper platform, so every transaction is recorded and we send reminders if a payment is delayed.",
  },
  {
    question: "What happens if my tenant leaves before the year ends?",
    answer: "We find a replacement at no extra charge.",
  },
  {
    question: "How are tenants screened?",
    answer:
      "Before the lease is signed, every tenant goes through social verification: employment check, CIBIL score and LinkedIn check. Police verification is completed within a month of signing. We also do reference checks where applicable.",
  },
  {
    question: "How are repair expenses approved?",
    answer:
      "Repairs under Rs. 1,000 are fixed right away and reimbursed by the owner later. Anything above Rs. 1,000 comes to you first, with cost estimates, for approval.",
  },
  {
    question: "Can TrustKeyper manage my property if I live outside Hyderabad or India?",
    answer:
      "Yes. This is why most NRI and out-of-city owners choose us. Approvals, updates and payments are fully digital, so you can manage your property remotely without a local point of contact.",
  },
  {
    question: "How often will I receive updates?",
    answer:
      "You get a monthly summary covering rent status, maintenance and tenant updates. For anything urgent, we reach out immediately.",
  },
  {
    question: "Can TrustKeyper manage a vacant property?",
    answer:
      "Yes. We handle listing, tenant sourcing, screening, background verification and move-in formalities. We also help with your current tenant's move-out.",
  },
  {
    question: "How do I get started?",
    answer:
      "Three steps: share your property details, we schedule a walkthrough, and we onboard your property. If it is vacant, tenant placement is included.",
  },
];

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `homeowner-faq-panel-${item.question}`;
  const buttonId = `homeowner-faq-button-${item.question}`;

  return (
    <div className="rounded-xl border-b border-marketing-azure-stroke">
      <button
        type="button"
        id={buttonId}
        className="flex w-full items-center justify-between gap-4 rounded-xl py-5 text-left"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="text-lg font-semibold leading-6 text-marketing-navy-dark">{item.question}</span>
        <ChevronDown
          size={20}
          strokeWidth={2}
          className={cn(
            "shrink-0 text-marketing-navy-dark transition-transform duration-200",
            isOpen && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {isOpen ? (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="pb-5">
          <p className="font-roboto text-sm leading-5 text-marketing-neutral-1000">{item.answer}</p>
        </div>
      ) : null}
    </div>
  );
}

export function HomeownerFaqSection() {
  const [openIndex, setOpenIndex] = React.useState(0);

  return (
    <section
      className="bg-white py-16 sm:bg-marketing-neutral-100 lg:py-[140px]"
      aria-labelledby="homeowner-faq-heading"
    >
      <div className="mx-auto max-w-[1228px] px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.5fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
              Frequently Asked Questions
            </p>
            <h2
              id="homeowner-faq-heading"
              className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-navy-dark"
            >
              Common questions
              <br />
              answered.
            </h2>
          </div>

          <div>
            {FAQ_ITEMS.map((item, index) => (
              <FaqAccordionItem
                key={item.question}
                item={item}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex((current) => (current === index ? -1 : index))}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

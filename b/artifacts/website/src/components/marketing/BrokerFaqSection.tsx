import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How does the broker partnership work for finding tenants?",
    answer:
      "Once onboarded, you get unlimited access to all available properties and can find tenants at your convenience. The brokerage you charge the tenant is fully yours. TrustKeyper takes nothing from it.",
  },
  {
    question: "Can I refer both property owners and tenants?",
    answer: "Yes. You can refer owners for management services and tenants looking for a property.",
  },
  {
    question: "Which areas can I refer properties from?",
    answer: "Any area of your choice, along with TrustKeyper's active service areas in Hyderabad.",
  },
  {
    question: "How do I sign up as a partner broker?",
    answer:
      "Sign up on the website and complete a quick onboarding step and then you're ready to earn. Onboarding usually takes less than an hour.",
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
  const panelId = `broker-faq-panel-${item.question}`;
  const buttonId = `broker-faq-button-${item.question}`;

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

export function BrokerFaqSection() {
  const [openIndex, setOpenIndex] = React.useState(0);

  return (
    <section className="bg-white py-16 sm:bg-marketing-neutral-100 lg:py-[140px]" aria-labelledby="broker-faq-heading">
      <div className="mx-auto max-w-[1228px] px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.5fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
              Frequently Asked Questions
            </p>
            <h2
              id="broker-faq-heading"
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

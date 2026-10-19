import React from "react";
import { Mail, Phone } from "lucide-react";
import { ContactForm } from "@/components/marketing/ContactForm";
import { CONTACT } from "@/lib/marketingConstants";

export function ContactSection() {
  return (
    <section className="bg-white pb-16 pt-8 sm:pb-20 sm:pt-12 lg:pb-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-16 lg:px-8 xl:px-12">
        <div className="max-w-xl lg:pt-4">
          <h1 className="text-[40px] font-medium leading-[1.12] tracking-tight text-marketing-navy sm:text-[44px] lg:text-[48px]">
            Get in touch
            <span className="block text-marketing-blue">with our team</span>
          </h1>

          <p className="mt-5 max-w-md font-roboto text-sm leading-relaxed text-marketing-muted sm:mt-6 sm:text-[15px]">
            From tenants screening to rent collection and maintenance, we handle everything for
            multi-property owners so you never have to worry, no matter where you are.
          </p>

          <div className="mt-8 space-y-4 sm:mt-10">
            <a
              href={CONTACT.phoneHref}
              className="flex items-center gap-3 text-sm text-marketing-body transition-colors hover:text-marketing-navy sm:text-[15px]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f2ff] text-marketing-blue">
                <Phone size={18} strokeWidth={2} aria-hidden />
              </span>
              {CONTACT.phone}
            </a>

            <a
              href={CONTACT.emailHref}
              className="flex items-center gap-3 text-sm text-marketing-body transition-colors hover:text-marketing-navy sm:text-[15px]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e8f2ff] text-marketing-blue">
                <Mail size={18} strokeWidth={2} aria-hidden />
              </span>
              {CONTACT.email}
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] bg-white p-5 shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)] sm:p-8 lg:p-10">
          <div className="[&_>div]:rounded-none [&_>div]:bg-transparent [&_>div]:p-0 [&_>div]:shadow-none [&_>div]:ring-0">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}

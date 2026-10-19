import React from "react";
import { ContactForm } from "@/components/marketing/ContactForm";
import contactIllustration from "@/assets/marketing/homeowners/contact-illustration.png";

export function HomeownerContactSection() {
  return (
    <section className="bg-marketing-neutral-1100 px-6 py-16 sm:px-8 sm:py-20 lg:px-8 lg:py-[140px]">
      <div className="mx-auto max-w-[1076px]">
        <div className="mx-auto max-w-[646px] text-center">
          <h2 className="font-marketing-heading text-[40px] font-medium leading-[46px] tracking-tight text-marketing-azure-050">
            Tell us about your property.
          </h2>
          <p className="mt-5 font-roboto text-sm leading-6 text-white/85 sm:text-base">
            Register your interest and our team will contact you to understand your requirements.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-[24px] bg-white p-5 shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)] sm:p-8 lg:mt-[60px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,316px)] lg:items-stretch lg:gap-10 lg:p-10">
          <div className="[&_>div]:rounded-none [&_>div]:bg-transparent [&_>div]:p-0 [&_>div]:shadow-none [&_>div]:ring-0">
            <ContactForm />
          </div>

          <div className="mt-6 hidden overflow-hidden rounded-xl shadow-[0_1px_2px_rgba(8,50,42,0.04),0_16px_40px_rgba(8,50,42,0.06)] lg:mt-0 lg:block lg:h-full">
            <img
              src={contactIllustration}
              alt=""
              className="h-full w-full object-cover object-top"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

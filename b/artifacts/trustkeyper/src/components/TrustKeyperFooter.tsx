import React from "react";
import { Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrustKeyperLogo } from "@/components/brand/TrustKeyperLogo";
import footerBackground from "@assets/trustkeyper_footer_background.png";

const FOOTER_LINKS = [
  { label: "Terms & Conditions", href: "https://trustkeyper.com/terms-and-conditions" },
  { label: "About Us", href: "https://trustkeyper.com/about-us" },
  { label: "FAQs", href: "https://trustkeyper.com/faqs" },
  { label: "Privacy Policy", href: "https://trustkeyper.com/privacy" },
] as const;

const NOIDA_ADDRESS =
  "Office 8, 1st Floor, Block: Mart, Mahagun Moderne, Plot GH-02, Sector 78, Noida, UP, India, 201301";

const BENGALURU_ADDRESS =
  "HD-198, Embassy TechVillage, Outer Ring Road, Bellandur, Bengaluru, Karnataka, India, 560103";

export interface TrustKeyperFooterProps {
  className?: string;
}

/**
 * Site-wide footer — 328px tall on desktop (md+), auto height on smaller screens.
 */
export function TrustKeyperFooter({ className }: TrustKeyperFooterProps) {
  return (
    <footer
      className={cn(
        "relative w-full shrink-0 overflow-hidden bg-[#0D1A48]",
        "min-h-0 md:min-h-[328px] md:h-[328px]",
        className,
      )}
    >
      <img
        src={footerBackground}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-left select-none"
      />

      <div className="relative z-10 flex h-full min-h-0 items-center">
        <div className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-10 sm:py-12 md:px-12 md:py-0 lg:px-16">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 md:grid-cols-12 md:items-center md:gap-x-10 lg:gap-x-12">
            <div className="md:col-span-3 flex items-start md:items-center">
              <TrustKeyperLogo variant="inverse" size="footer" />
            </div>

            <nav
              className="md:col-span-2 flex flex-col gap-3 md:gap-3.5"
              aria-label="Footer"
            >
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-slate-300/90 transition-colors duration-200 hover:text-white md:text-[15px]"
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="md:col-span-3 space-y-5 text-[13px] leading-[1.65] text-slate-400 md:space-y-6 md:leading-[1.7]">
              <div>
                <p className="mb-2 text-sm font-semibold tracking-tight text-white md:mb-2.5 md:text-[15px]">
                  Noida
                </p>
                <p>{NOIDA_ADDRESS}</p>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold tracking-tight text-white md:mb-2.5 md:text-[15px]">
                  Bengaluru
                </p>
                <p>{BENGALURU_ADDRESS}</p>
              </div>
            </div>

            <div className="md:col-span-4 space-y-5 text-[13px] leading-[1.65] text-slate-400 md:space-y-6 md:leading-[1.7]">
              <div>
                <p className="mb-3 text-sm font-semibold tracking-tight text-white md:mb-4 md:text-[15px]">
                  Contact :
                </p>
                <a
                  href="tel:+918088516875"
                  className="mb-2.5 flex items-center gap-2.5 text-slate-300/95 transition-colors duration-200 hover:text-white md:mb-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
                    <Phone size={14} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="text-[14px]">+91 8088516875</span>
                </a>
                <a
                  href="mailto:info@trustkeyper.com"
                  className="flex items-center gap-2.5 text-slate-300/95 underline decoration-white/25 underline-offset-[3px] transition-colors duration-200 hover:text-white hover:decoration-white/50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
                    <Mail size={14} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="text-[14px]">info@trustkeyper.com</span>
                </a>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold tracking-tight text-white md:mb-2.5 md:text-[15px]">
                  Head office :
                </p>
                <p>{BENGALURU_ADDRESS}</p>
              </div>
              <p>TrustKeyper — A Brand by Paravent | GST: 09AKVPM7660B1ZP</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

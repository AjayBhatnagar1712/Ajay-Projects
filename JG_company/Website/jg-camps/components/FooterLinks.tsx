"use client";

import Link from "next/link";
import { useCallback } from "react";

const WHATSAPP_NUMBER = "+918076874156";
const SUPPORT_PHONE = "+91-80768-74156";

const waLink = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;

export default function FooterLinks() {
  const openContactModal = useCallback(() => {
    window.dispatchEvent(new Event("open-contact-expert"));
  }, []);

  return (
    <div>
      <h4 className="font-bold">Support</h4>
      <ul className="mt-4 grid gap-3 text-sm text-emerald-50/80">
        <li>
          <a className="hover:text-amber-300" href={`tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`}>
            Call {SUPPORT_PHONE}
          </a>
        </li>
        <li>
          <a className="hover:text-amber-300" href={waLink("Hello! I need help planning a trip.")}>
            WhatsApp
          </a>
        </li>
        <li>
          <button onClick={openContactModal} className="p-0 text-left hover:text-amber-300">
            Contact Travel Expert
          </button>
        </li>
        <li>
          <Link href="/about" className="hover:text-amber-300">
            About Journey Gate
          </Link>
        </li>
      </ul>
    </div>
  );
}

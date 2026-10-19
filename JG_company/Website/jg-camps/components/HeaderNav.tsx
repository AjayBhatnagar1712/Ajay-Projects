"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { CalendarPlus, ChevronDown, Menu, MessageCircle, X } from "lucide-react";

const DESTINATIONS = [
  ["Himalayan Belt", "/india/north"],
  ["Group Retreats", "/group-retreats"],
  ["Spiritual Tourism", "/spiritual"],
] as const;

export default function HeaderNav() {
  const [destOpen, setDestOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openPlanner = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    setMobileOpen(false);
    window.dispatchEvent(new Event("open-planner"));
  }, []);

  const openContact = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    setMobileOpen(false);
    window.dispatchEvent(new Event("open-contact-expert"));
  }, []);

  const navBody = (
    <>
      <div className="relative">
        <button
          onClick={() => setDestOpen((s) => !s)}
          aria-expanded={destOpen}
          className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white/90 hover:bg-cyan-100/10"
        >
          Destinations
          <ChevronDown className="h-4 w-4" />
        </button>

        <div
          className={`absolute right-0 mt-3 w-64 overflow-hidden rounded-2xl border border-sky-100 bg-white text-slate-800 shadow-2xl shadow-sky-950/15 transition ${
            destOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
          }`}
          onMouseLeave={() => setDestOpen(false)}
        >
          <div className="grid p-2">
            {DESTINATIONS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={() => {
                  setDestOpen(false);
                  setMobileOpen(false);
                }}
                className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-sky-50 hover:text-sky-900"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <button onClick={openPlanner} className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-white/90 hover:bg-cyan-100/10 sm:inline-flex">
        <CalendarPlus className="h-4 w-4" />
        Plan
      </button>

      <Link href="/about" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-white/90 hover:bg-cyan-100/10 sm:inline-flex">
        About
      </Link>

      <button onClick={openContact} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-200 to-yellow-300 px-4 py-2 text-sm font-black text-sky-950 shadow-lg shadow-sky-950/20 hover:brightness-105">
        <MessageCircle className="h-4 w-4" />
        Contact
      </button>
    </>
  );

  return (
    <>
      <nav className="hidden items-center gap-2 md:flex">{navBody}</nav>
      <button
        onClick={() => setMobileOpen((s) => !s)}
        className="grid h-10 w-10 place-items-center rounded-full bg-white/10 md:hidden"
        aria-label="Open navigation"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div className="absolute left-4 right-4 top-[68px] z-50 rounded-3xl border border-white/10 bg-sky-950/95 p-4 shadow-2xl backdrop-blur-xl md:hidden">
          <div className="grid gap-2">
            {DESTINATIONS.map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 hover:bg-cyan-100/10">
                {label}
              </Link>
            ))}
            <button onClick={openPlanner} className="rounded-2xl px-4 py-3 text-left text-sm font-semibold text-white/90 hover:bg-cyan-100/10">
              Plan a Trip
            </button>
            <Link href="/about" onClick={() => setMobileOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 hover:bg-cyan-100/10">
              About
            </Link>
            <button onClick={openContact} className="rounded-2xl bg-gradient-to-r from-amber-200 to-yellow-300 px-4 py-3 text-left text-sm font-black text-sky-950">
              Contact Travel Expert
            </button>
          </div>
        </div>
      )}
    </>
  );
}

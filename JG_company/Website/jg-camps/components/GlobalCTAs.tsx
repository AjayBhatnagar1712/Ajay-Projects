"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import PlannerModal from "./PlannerModal";
import ContactExpertModal from "./ContactExpertModal";
import { logLead } from "@/lib/logLead";

export default function GlobalCTAs() {
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  // Accessibility: show focus rings only for keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Tab" && setIsKeyboardUser(true);
    const onMouse = () => setIsKeyboardUser(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouse);
    };
  }, []);

  // Global events so other components can open/close these modals
  useEffect(() => {
    const openContact = () => setContactOpen(true);
    const openPlanner = () => setPlannerOpen(true);
    const closeAll = () => {
      setPlannerOpen(false);
      setContactOpen(false);
    };

    window.addEventListener("open-contact-expert", openContact as EventListener);
    window.addEventListener("open-planner", openPlanner as EventListener);
    window.addEventListener("open-planner-with", openPlanner as EventListener);
    window.addEventListener("close-ctas", closeAll as EventListener);

    return () => {
      window.removeEventListener("open-contact-expert", openContact as EventListener);
      window.removeEventListener("open-planner", openPlanner as EventListener);
      window.removeEventListener("open-planner-with", openPlanner as EventListener);
      window.removeEventListener("close-ctas", closeAll as EventListener);
    };
  }, []);

  const openPlanner = () => {
    logLead({ channel: "cta-itinerary", note: "Clicked Get Itinerary" });
    setPlannerOpen(true);
  };

  const openContact = () => {
    logLead({ channel: "cta-contact", note: "Clicked Contact Travel Expert" });
    setContactOpen(true);
  };

  return (
    <>
      {/* Floating CTA bar */}
      <div
        id="global-ctas"
        className={[
          "fixed inset-x-3 bottom-3 z-50 md:inset-x-auto md:left-auto md:right-24 md:bottom-6",
          "grid grid-cols-2 gap-2 md:flex md:flex-row md:gap-3",
          "pointer-events-auto",
          "pb-[env(safe-area-inset-bottom,0px)]",
        ].join(" ")}
        aria-label="Quick actions"
      >
        <button
          onClick={openPlanner}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-full",
            "bg-sky-950/92 text-white backdrop-blur",
            "px-3 py-3 text-xs font-bold shadow-2xl shadow-sky-950/20 hover:-translate-y-0.5 hover:bg-sky-900 transition sm:px-4 sm:text-sm",
            isKeyboardUser ? "focus:outline focus:outline-2 focus:outline-ring/60" : "focus:outline-none",
          ].join(" ")}
          aria-haspopup="dialog"
          aria-expanded={plannerOpen}
        >
          Get an Itinerary
        </button>

        <button
          onClick={openContact}
          className={[
            "inline-flex items-center justify-center gap-2 rounded-full",
            "bg-gradient-to-r from-amber-200 to-yellow-300 text-sky-950",
            "px-3 py-3 text-xs font-black shadow-2xl shadow-sky-950/15 hover:-translate-y-0.5 hover:brightness-105 transition sm:px-4 sm:text-sm",
            isKeyboardUser ? "focus:outline focus:outline-2 focus:outline-ring/60" : "focus:outline-none",
          ].join(" ")}
          aria-haspopup="dialog"
          aria-expanded={contactOpen}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Contact Travel Expert</span>
          <span className="sm:hidden">Expert</span>
        </button>
      </div>

      {/* Modals */}
      <PlannerModal open={plannerOpen} onClose={() => setPlannerOpen(false)} />
      <ContactExpertModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}

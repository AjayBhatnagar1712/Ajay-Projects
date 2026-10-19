import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FilePlus2, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Auto-advance interval for welcome education slides (8 seconds). */
export const WELCOME_CAROUSEL_SLIDE_MS = 8000;
const SLIDE_MS = WELCOME_CAROUSEL_SLIDE_MS;

type Slide = {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  icon: React.ReactNode;
  onAction: () => void;
};

interface WelcomeEducationCarouselProps {
  onGenerateAgreement: () => void;
  onAddProperty: () => void;
  onAddTenant: () => void;
}

export function WelcomeEducationCarousel({
  onGenerateAgreement,
  onAddProperty,
  onAddTenant,
}: WelcomeEducationCarouselProps) {
  const slides: Slide[] = [
    {
      id: "agreement",
      title: "Generate Rental Agreement",
      description:
        "Generate rental agreements, collect documents, and complete digital signing, all in one place with TrustKeyper.",
      ctaLabel: "Generate Agreement",
      icon: <FilePlus2 size={24} className="text-primary" />,
      onAction: onGenerateAgreement,
    },
    {
      id: "property",
      title: "Add Your First Property",
      description:
        "List and manage your property details to start renting seamlessly through TrustKeyper.",
      ctaLabel: "Add Property",
      icon: <Plus size={24} className="text-gray-700" />,
      onAction: onAddProperty,
    },
    {
      id: "tenant",
      title: "Add Potential Tenants",
      description:
        "Add tenant details, send invitations, and manage the rental process digitally through TrustKeyper.",
      ctaLabel: "Add Tenant",
      icon: <UserPlus size={24} className="text-accent" />,
      onAction: onAddTenant,
    },
  ];

  const [index, setIndex] = useState(0);
  const [progressEpoch, setProgressEpoch] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scheduleAdvance = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
      setProgressEpoch((e) => e + 1);
    }, SLIDE_MS);
  }, [slides.length]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(next);
      setProgressEpoch((e) => e + 1);
      scheduleAdvance();
    },
    [scheduleAdvance],
  );

  const goPrev = useCallback(() => {
    goTo((index - 1 + slides.length) % slides.length);
  }, [goTo, index, slides.length]);

  const goNext = useCallback(() => {
    goTo((index + 1) % slides.length);
  }, [goTo, index, slides.length]);

  useEffect(() => {
    scheduleAdvance();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [scheduleAdvance]);

  return (
    <div className="md:hidden w-full">
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div
          key={progressEpoch}
          className="h-1 w-full bg-gray-100 overflow-hidden"
          aria-hidden
        >
          <div
            className="h-full origin-left bg-primary"
            style={{
              animation: `welcome-carousel-progress ${SLIDE_MS}ms linear forwards`,
            }}
          />
        </div>

        <div className="relative min-h-[300px] p-6">

          {slides.map((s, i) => (
            <article
              key={s.id}
              className={cn(
                "absolute inset-0 flex flex-col p-6 pt-5 transition-all duration-500 ease-out",
                i === index
                  ? "opacity-100 translate-x-0 pointer-events-auto z-10"
                  : i < index
                    ? "opacity-0 -translate-x-6 pointer-events-none z-0"
                    : "opacity-0 translate-x-6 pointer-events-none z-0",
              )}
              aria-hidden={i !== index}
            >
              <div
                className={cn(
                  "mb-5 flex h-12 w-12 items-center justify-center rounded-xl ring-8",
                  s.id === "agreement"
                    ? "bg-primary/10 ring-primary/5"
                    : s.id === "tenant"
                      ? "bg-gray-100 ring-gray-50 group-hover:bg-accent/10"
                      : "bg-gray-100 ring-gray-50",
                )}
              >
                {s.icon}
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-gray-900 mb-3">{s.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm">{s.description}</p>
              <div className="mt-auto border-t border-gray-100 pt-4 space-y-4">
                <button
                  type="button"
                  onClick={s.onAction}
                  className="inline-flex w-fit items-center gap-2 font-semibold text-primary transition-all hover:gap-3"
                >
                  {s.id === "agreement" ? <FilePlus2 size={16} /> : s.id === "tenant" ? <UserPlus size={16} /> : <Plus size={16} />}
                  {s.ctaLabel}
                </button>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous slide"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next slide"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-2 mt-4" role="tablist" aria-label="Education slides">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show ${s.title}`}
            onClick={() => goTo(i)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              i === index ? "w-6 bg-primary" : "w-2 bg-gray-300 hover:bg-gray-400",
            )}
          />
        ))}
      </div>

      <style>{`
        @keyframes welcome-carousel-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}

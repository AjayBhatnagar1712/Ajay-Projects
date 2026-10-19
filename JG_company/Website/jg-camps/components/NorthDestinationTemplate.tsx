"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Compass,
  MapPinned,
  MessageCircle,
  Route,
  ShieldCheck,
} from "lucide-react";

export type NorthDestinationData = {
  name: string;
  image: string;
  bestSeason: string;
  highlights: string;
  badge?: string;
  moodTitle: string;
  moodText: string;
  locations: string[];
  descriptions: Record<string, string>;
  routeSteps: Array<{
    title: string;
    meta: string;
    text: string;
  }>;
  safety: string[];
  avoid: string[];
  extraChips?: string[];
};

type Props = {
  data: NorthDestinationData;
};

export default function NorthDestinationTemplate({ data }: Props) {
  const openContact = () => window.dispatchEvent(new Event("open-contact-expert"));

  const openPlannerWith = (location?: string) => {
    window.dispatchEvent(
      new CustomEvent("open-planner-with", {
        detail: {
          state: data.name,
          location: location || data.name,
        },
      })
    );
  };

  return (
    <main className="bg-[#020712] text-white">
      <section className="relative min-h-[64vh] overflow-hidden">
        <Image src={data.image} alt={data.name} fill priority className="object-cover" sizes="100vw" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,7,18,0.94),rgba(2,7,18,0.60),rgba(2,7,18,0.22)),linear-gradient(180deg,rgba(2,7,18,0.12),#020712_96%)]" />

        <div className="relative z-10 mx-auto grid min-h-[64vh] max-w-7xl items-end gap-8 px-4 pb-12 pt-20 sm:px-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
              <Compass className="h-4 w-4 text-amber-200" />
              {data.badge || "Private travel planning"}
            </div>
            <h1 className="mt-5 max-w-4xl text-[clamp(3rem,7vw,6.6rem)] font-black leading-[0.9] tracking-tight">{data.name}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">{data.highlights}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => openPlannerWith()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-200 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-black/20 hover:bg-amber-100">
                Create itinerary <CalendarDays className="h-4 w-4" />
              </button>
              <button onClick={openContact} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/18 bg-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white/15">
                Ask an expert <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          <aside className="rounded-lg border border-white/12 bg-[#071523]/86 p-4 shadow-xl shadow-black/20">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Quick read</div>
            <div className="mt-4 grid gap-3">
              {[
                ["Best season", data.bestSeason],
                ["Travel style", data.moodTitle],
                ["Planning", "Custom route, stays and transport"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-white/10 bg-white/[0.06] p-3">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
                  <div className="mt-1 text-sm font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-12 sm:px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(125,211,252,0.10),transparent_25rem),linear-gradient(180deg,#020712,#061524_50%,#020712)]" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="ladakh-sticky-panel h-fit rounded-lg border border-white/12 bg-white/[0.06] p-5">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Route className="h-4 w-4" />
                How the trip works
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight !text-white">{data.moodTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{data.moodText}</p>

              <div className="mt-5 grid gap-3">
                {data.routeSteps.map((step, index) => (
                  <div key={step.title} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">{step.meta}</span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-black text-slate-950">{index + 1}</span>
                    </div>
                    <div className="mt-2 text-base font-black text-white">{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{step.text}</p>
                  </div>
                ))}
              </div>

              {data.extraChips?.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {data.extraChips.map((chip) => (
                    <span key={chip} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-bold text-slate-200">
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </aside>

            <div>
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                    <MapPinned className="h-4 w-4" />
                    Locations
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight !text-white md:text-5xl">Choose what to include.</h2>
                </div>
                <button onClick={() => openPlannerWith()} className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-black text-white hover:bg-white/14">
                  Build full route <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="ladakh-3d-stage grid gap-4 md:grid-cols-2">
                {data.locations.map((location, index) => (
                  <article key={location} className="ladakh-3d-card group rounded-lg border border-white/12 bg-[#071523] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white text-xs font-black text-slate-950">{String(index + 1).padStart(2, "0")}</span>
                      <button onClick={() => openPlannerWith(location)} className="rounded-full border border-white/12 px-3 py-1 text-xs font-black text-slate-200 transition hover:border-amber-200 hover:text-amber-100">
                        Plan
                      </button>
                    </div>
                    <h3 className="mt-4 text-xl font-black text-white">{shortLabel(location)}</h3>
                    <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-300">
                      {data.descriptions[location] || "Add this stop to your route for local culture, food, views and a better-paced travel plan."}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div className="rounded-lg border border-white/12 bg-white/[0.06] p-5">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <ShieldCheck className="h-4 w-4" />
                Keep it smooth
              </div>
              <div className="mt-4 grid gap-3">
                {data.safety.map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-black/18 p-3 text-sm leading-6 text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200/18 bg-amber-200/[0.07] p-5">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Avoid these mistakes
              </div>
              <div className="mt-4 grid gap-3">
                {data.avoid.map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-black/18 p-3 text-sm leading-6 text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-white/12 bg-white p-5 text-slate-950 shadow-xl shadow-black/18 md:flex md:items-center md:justify-between md:gap-6">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Concierge route build</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Plan {data.name} with the right route flow.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Share dates, guests and comfort level. Journey Gate will shape the route, stays and transport flow.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-0">
              <button onClick={() => openPlannerWith()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white">
                Create itinerary <CalendarDays className="h-4 w-4" />
              </button>
              <button onClick={openContact} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-200 px-5 py-3 text-sm font-black text-slate-950">
                Expert help <MessageCircle className="h-4 w-4" />
              </button>
              <Link href="/india/north" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-5 py-3 text-sm font-black text-slate-800">
                <ArrowLeft className="h-4 w-4" /> Routes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function shortLabel(location: string) {
  const match = location.match(/^([^(,]+)/);
  return match ? match[1].trim() : location;
}

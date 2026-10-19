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

const DATA = {
  name: "Leh & Ladakh",
  image: "/images/north-india/leh-ladakh/leh-hero.jpg",
  bestSeason: "May - Sep",
  highlights:
    "High passes, blue lakes, monastery mornings and desert valleys, planned with altitude-safe pacing.",
};

const SCENE_IMAGES = {
  leh: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Indus_Valley_near_Leh.jpg/1280px-Indus_Valley_near_Leh.jpg",
  thiksey:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Thiksey_Monastery%2C_Ladakh_01.jpg/1280px-Thiksey_Monastery%2C_Ladakh_01.jpg",
  nubra:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Nubra_Valley_%2828321828540%29.jpg/1280px-Nubra_Valley_%2828321828540%29.jpg",
  pangong:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Pangong_Tso_%2828527629251%29.jpg/1280px-Pangong_Tso_%2828527629251%29.jpg",
  moriri: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Tso_Moriri_-_2.jpg/1280px-Tso_Moriri_-_2.jpg",
  lamayuru: "https://upload.wikimedia.org/wikipedia/commons/a/a9/Lamayuru-Gompa-02.jpg",
};

const GLANCE = [
  ["Best season", DATA.bestSeason],
  ["First rule", "Rest in Leh before high passes"],
  ["Ideal pace", "6-8 days minimum"],
];

const ROUTE_STEPS = [
  {
    title: "Land softly",
    meta: "Day 1-2",
    text: "Arrive in Leh, rest, short market walks, Shanti Stupa, Leh Palace and easy acclimatisation.",
  },
  {
    title: "Cross the passes",
    meta: "Day 3-5",
    text: "Move toward Nubra through Khardung La, Diskit, Hunder dunes and carefully timed valley stays.",
  },
  {
    title: "Chase the lakes",
    meta: "Day 6-8",
    text: "Pangong or Tso Moriri with permit-aware routing, vehicle planning and buffer time for roads.",
  },
];

const SCENES = [
  {
    title: "Leh acclimatisation",
    location: "Leh Town & Leh Bazaar",
    image: SCENE_IMAGES.leh,
    tag: "Soft landing",
    text: "Cafes, old market lanes, palace views and easy evenings before the altitude rises.",
  },
  {
    title: "Monastery circuit",
    location: "Hemis Monastery",
    image: SCENE_IMAGES.thiksey,
    tag: "Culture",
    text: "Hemis, Thiksey, Shey and Alchi with calm pacing and respectful visit windows.",
  },
  {
    title: "Nubra Valley",
    location: "Nubra Valley (Diskit, Hunder)",
    image: SCENE_IMAGES.nubra,
    tag: "Desert valley",
    text: "Khardung La, Diskit monastery, Hunder dunes and warmer valley stays.",
  },
  {
    title: "Pangong Tso",
    location: "Pangong Tso (Spangmik, Lukung)",
    image: SCENE_IMAGES.pangong,
    tag: "Blue lake",
    text: "A cinematic lake day planned around road time, permits, weather and comfort.",
  },
  {
    title: "Tso Moriri",
    location: "Tso Moriri (Korzok)",
    image: SCENE_IMAGES.moriri,
    tag: "Remote",
    text: "Quieter, farther and more delicate. Best for slower travelers with flexible dates.",
  },
  {
    title: "Lamayuru Moonland",
    location: "Lamayuru (Moonland)",
    image: SCENE_IMAGES.lamayuru,
    tag: "Road scene",
    text: "Ancient monastery, lunar rock formations and one of the region's most dramatic drives.",
  },
];

const SAFETY = [
  "Rest in Leh for 1-2 days before high passes.",
  "Keep alcohol, overexertion and rushed sightseeing out of the first 24-48 hours.",
  "Use dependable vehicles and drivers for Nubra, Pangong and remote lake routes.",
  "Keep permits, medicines, layers and buffer time ready before leaving Leh.",
];

const AVOID = [
  "Same-day high-pass plans after landing.",
  "Overpacked itineraries with long drives every day.",
  "Random camps or routes without road and permit checks.",
  "Littering near lakes, monasteries or fragile desert zones.",
];

export default function LehLadakhPage() {
  const openContact = () => window.dispatchEvent(new Event("open-contact-expert"));

  const openPlannerWith = (state: string, location?: string) => {
    window.dispatchEvent(new CustomEvent("open-planner-with", { detail: { state, location } }));
  };

  const createItineraryAuto = () => openPlannerWith(DATA.name);

  return (
    <main className="bg-[#020712] text-white">
      <section className="relative min-h-[68vh] overflow-hidden">
        <Image src={DATA.image} alt={DATA.name} fill priority className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,7,18,0.94),rgba(2,7,18,0.62),rgba(2,7,18,0.22)),linear-gradient(180deg,rgba(2,7,18,0.08),#020712_96%)]" />

        <div className="relative z-10 mx-auto grid min-h-[68vh] max-w-7xl items-end gap-8 px-4 pb-12 pt-20 sm:px-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
              <Compass className="h-4 w-4 text-amber-200" />
              Altitude-safe private planning
            </div>
            <h1 className="mt-5 max-w-4xl text-[clamp(3.1rem,7vw,6.8rem)] font-black leading-[0.9] tracking-tight">{DATA.name}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-200 sm:text-lg">{DATA.highlights}</p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button onClick={createItineraryAuto} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-200 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-black/20 hover:bg-amber-100">
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
              {GLANCE.map(([label, value]) => (
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(125,211,252,0.11),transparent_25rem),linear-gradient(180deg,#020712,#061524_50%,#020712)]" />

        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <aside className="ladakh-sticky-panel h-fit rounded-lg border border-white/12 bg-white/[0.06] p-5">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
                <Route className="h-4 w-4" />
                How the trip works
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight !text-white">Simple route flow.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Ladakh becomes smooth when the journey is built in the right order. Start soft, climb slowly, then add the big lake scenes.
              </p>

              <div className="mt-5 grid gap-3">
                {ROUTE_STEPS.map((step, index) => (
                  <div key={step.title} className="rounded-md border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">{step.meta}</span>
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-black text-slate-950">
                        {index + 1}
                      </span>
                    </div>
                    <div className="mt-2 text-base font-black text-white">{step.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{step.text}</p>
                  </div>
                ))}
              </div>
            </aside>

            <div>
              <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                    <MapPinned className="h-4 w-4" />
                    3D route cards
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-tight !text-white md:text-5xl">Pick the scenes you want.</h2>
                </div>
                <button onClick={createItineraryAuto} className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/14 bg-white/8 px-4 py-2.5 text-sm font-black text-white hover:bg-white/14">
                  Build full route <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="ladakh-3d-stage grid gap-4 md:grid-cols-2">
                {SCENES.map((scene, index) => (
                  <article key={scene.title} className="ladakh-3d-card group overflow-hidden rounded-lg border border-white/12 bg-[#071523]">
                    <div className="relative h-48 overflow-hidden">
                      <Image src={scene.image} alt={scene.title} fill className="object-cover transition duration-500 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/74 via-black/12 to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-950">{scene.tag}</div>
                      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                        <h3 className="text-2xl font-black text-white">{scene.title}</h3>
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-amber-200 text-xs font-black text-slate-950">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="min-h-[72px] text-sm leading-6 text-slate-300">{scene.text}</p>
                      <button onClick={() => openPlannerWith(DATA.name, scene.location)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-black text-slate-950">
                        Plan this scene <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
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
                {SAFETY.map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-black/18 p-3 text-sm leading-6 text-slate-200">{item}</div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200/18 bg-amber-200/[0.07] p-5">
              <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Avoid these mistakes
              </div>
              <div className="mt-4 grid gap-3">
                {AVOID.map((item) => (
                  <div key={item} className="rounded-md border border-white/10 bg-black/18 p-3 text-sm leading-6 text-slate-200">{item}</div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-white/12 bg-white p-5 text-slate-950 shadow-xl shadow-black/18 md:flex md:items-center md:justify-between md:gap-6">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Concierge route build</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight">Let us build the route in the right order.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Share dates, guests and comfort level. Journey Gate will shape the route, permits, stays and transport flow.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-0">
              <button onClick={createItineraryAuto} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white">
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

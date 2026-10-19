"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Globe2 } from "lucide-react";
import { INTERNATIONAL_TRIPS } from "@/data/internationalTrips";

const CATEGORIES = ["All", "Europe", "Southeast Asia", "Middle East", "Adventure", "Luxury"];

export default function InternationalPage() {
  const [active, setActive] = useState("All");
  const filtered = useMemo(
    () => (active === "All" ? INTERNATIONAL_TRIPS : INTERNATIONAL_TRIPS.filter((trip) => trip.category === active)),
    [active]
  );

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="relative min-h-[70vh] overflow-hidden">
        <Image src="/images/International/international-hero.jpg" alt="International travel" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-slate-950/10" />
        <div className="relative z-10 mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-end px-6 pb-14 pt-28 text-white">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
            <Globe2 className="h-4 w-4" />
            Curated international holidays
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-7xl">Discover the World, Beautifully</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">
            Premium international itineraries across Europe, Asia, the Middle East, adventure routes, and luxury escapes.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-wrap gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                active === cat
                  ? "border-emerald-800 bg-emerald-800 text-white"
                  : "border-emerald-100 bg-white text-emerald-900 hover:bg-emerald-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <AnimatePresence mode="popLayout">
          <motion.div layout className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((trip) => (
              <motion.article
                layout
                key={trip.slug}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.25 }}
              >
                <Link href={`/international/${trip.slug}`} className="group block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-950/5">
                  <div className="relative h-64 overflow-hidden">
                    <Image src={trip.image} alt={trip.title} fill className="object-cover transition duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-slate-950">
                      {trip.category}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-2xl font-black text-slate-950">{trip.title}</h3>
                    <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">{trip.description}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-sm font-semibold text-emerald-800">{trip.duration}</span>
                      <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-700">
                        View trip <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.article>
            ))}
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}

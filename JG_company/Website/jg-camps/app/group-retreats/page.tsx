// app/group-retreats/page.tsx
"use client";

import slugify from "@/lib/slugify"; // imported as you requested

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import React from "react";

/**
 * Place hero & card images in:
 * public/images/group-retreats/hero.jpg
 * public/images/group-retreats/corporate.jpg
 * public/images/group-retreats/training.jpg
 * public/images/group-retreats/schools.jpg
 * public/images/group-retreats/colleges.jpg
 * public/images/group-retreats/open-tours.jpg
 * public/images/group-retreats/family.jpg
 * public/images/group-retreats/spiritual.jpg
 * public/images/group-retreats/custom.jpg
 */

const CARDS = [
  { key: "corporate", title: "Corporate Tours", image: "/images/group-retreats/corporate.jpg", blurb: "Offsites, leadership days, team-building adventures and incentives." },
  { key: "training", title: "Training Programs", image: "/images/group-retreats/training.jpg", blurb: "Skill workshops, experiential learning and immersive training camps." },
  { key: "schools", title: "Schools", image: "/images/group-retreats/schools.jpg", blurb: "Educational trips, nature camps and activity-based learning for students." },
  { key: "colleges", title: "Colleges", image: "/images/group-retreats/colleges.jpg", blurb: "Adventure trips, leadership & field programmes tailored for students." },
  { key: "open", title: "Open Tours", image: "/images/group-retreats/open-tours.jpg", blurb: "Public group departures for like-minded travellers and niche themes." },
  { key: "family", title: "Family Tours", image: "/images/group-retreats/family.jpg", blurb: "Multi-generational itineraries, easy logistics and family-friendly activities." },
  { key: "spiritual", title: "Spiritual & Pilgrimage", image: "/images/group-retreats/spiritual.jpg", blurb: "Pilgrimage circuits, ashram stays and spiritual trail logistics." },
  { key: "custom", title: "Create Your Own Group", image: "/images/group-retreats/custom.jpg", blurb: "Have a vision? We'll build a fully-branded itinerary and handle logistics." },
];

export default function GroupRetreatsPage() {
  return (
    <main className="bg-white text-slate-800">
      {/* HERO */}
      <section className="relative w-full h-[60vh] md:h-[64vh] overflow-hidden rounded-b-3xl shadow-lg">
        <Image
          src="/images/group-retreats/hero.jpg"
          alt="Group retreats hero"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/30 to-transparent" />
        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="max-w-3xl text-white">
            <motion.h1 initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }} className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight drop-shadow-md">
              Group Retreats & Programs
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 text-lg sm:text-xl max-w-2xl text-emerald-100">
              Corporate offsites, school camps, family groups, spiritual circuits — we design group journeys that meet your objectives and budget.
            </motion.p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/group-retreats/plan"
                className="inline-flex items-center gap-3 bg-amber-400 text-black px-5 py-3 rounded-2xl font-semibold shadow-lg hover:brightness-95 transition"
                aria-label="Build group itinerary"
              >
                Build Itinerary
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M6 5l6 5-6 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>

              <button onClick={() => window.dispatchEvent(new Event("open-contact-expert"))} className="inline-flex items-center gap-3 border border-white/30 text-white px-5 py-3 rounded-2xl font-semibold hover:bg-white/10 transition">
                Contact Travel Expert
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* WHY / FEATURES */}
      <section className="py-12 px-6 container mx-auto">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold">Group formats we specialise in</h2>
            <p className="mt-3 text-lg text-gray-600 max-w-prose">
              Whether it's a high-impact corporate offsite, experiential training, a school nature camp, or a family reunion — we have proven templates and on-ground logistics to deliver.
            </p>

            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <li className="flex gap-4 items-start">
                <div className="h-10 w-10 rounded-md bg-emerald-50 grid place-items-center text-emerald-700 font-bold">✓</div>
                <div>
                  <div className="font-semibold">Custom agendas</div>
                  <div className="text-sm text-gray-600">Workshops, activities, leisure time and transport — balanced to your objectives.</div>
                </div>
              </li>

              <li className="flex gap-4 items-start">
                <div className="h-10 w-10 rounded-md bg-emerald-50 grid place-items-center text-emerald-700 font-bold">✓</div>
                <div>
                  <div className="font-semibold">Safety & permits</div>
                  <div className="text-sm text-gray-600">Experienced local partners and compliance for events and adventure activities.</div>
                </div>
              </li>

              <li className="flex gap-4 items-start">
                <div className="h-10 w-10 rounded-md bg-emerald-50 grid place-items-center text-emerald-700 font-bold">✓</div>
                <div>
                  <div className="font-semibold">Scalable logistics</div>
                  <div className="text-sm text-gray-600">From 10 to 300+ participants — transport, meals, and venues handled end-to-end.</div>
                </div>
              </li>

              <li className="flex gap-4 items-start">
                <div className="h-10 w-10 rounded-md bg-emerald-50 grid place-items-center text-emerald-700 font-bold">✓</div>
                <div>
                  <div className="font-semibold">Impact measurement</div>
                  <div className="text-sm text-gray-600">Post-event reports, attendance tracking and feedback capture available.</div>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl overflow-hidden shadow-xl bg-gradient-to-tr from-white to-emerald-50 p-1">
            <div className="relative rounded-xl overflow-hidden h-72 sm:h-80">
              <Image src="/images/group-retreats/hero.jpg" alt="Group retreats" fill className="object-cover" priority />
            </div>
          </div>
        </div>
      </section>

      {/* CARDS GRID */}
      <section className="py-12 px-6 bg-slate-50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Choose a group format</h2>

          <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {CARDS.map((c) => (
              <article key={c.key} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 hover:scale-[1.01] transition">
                <div className="relative h-48">
                  <Image src={c.image} alt={c.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-emerald-800 mb-2">{c.title}</h3>
                  <p className="text-gray-700 mb-4">{c.blurb}</p>
                  <div className="flex items-center justify-between gap-3">
                    {/* Changed: link now goes to the individual card page (/group-retreats/<key>) */}
                    <Link href={`/group-retreats/${slugify(c.key)}`} className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 hover:underline">
                      View details →
                    </Link>
                    <button onClick={() => window.dispatchEvent(new CustomEvent("log-lead", { detail: { channel: "group-card", format: c.key } }))} className="text-sm rounded-full border py-2 px-3 text-emerald-700 hover:bg-emerald-50 transition">
                      Enquire
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-6">
        <div className="container mx-auto rounded-3xl bg-gradient-to-r from-amber-50/80 to-amber-100 p-8 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-2xl font-bold text-emerald-800">Ready to organise your group?</h3>
            <p className="mt-2 text-gray-700 max-w-xl">
              Tell us your dates and objectives — we'll propose a programme and cost estimate.
            </p>
          </div>

          <div className="flex gap-3">
            {/* This Contact button now opens the global Contact Travel Expert */}
            <button
              onClick={() => window.dispatchEvent(new Event("open-contact-expert"))}
              className="inline-flex items-center px-6 py-3 rounded-2xl bg-emerald-800 text-white font-semibold hover:brightness-95 transition"
            >
              Contact
            </button>

            <a
              href="/group-retreats/plan"
              className="inline-flex items-center px-6 py-3 rounded-2xl border border-emerald-200 text-emerald-800 font-semibold hover:bg-emerald-50 transition"
            >
              Build Group Itinerary
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

// app/spiritual/page.tsx
"use client";

import slugify from "@/lib/slugify";
import { motion, Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import PlannerModal from "@/components/PlannerModal";

type Place = {
  id: string;
  name: string;
  region?: string;
  image: string;
  blurb: string;
  bestSeason?: string;
};

const PLACES: Place[] = [
  { id: "kashi", name: "Varanasi (Kashi)", region: "Uttar Pradesh", image: "/images/spiritual/kashi.jpg", blurb: "Ancient ghats, Ganga aarti and a city steeped in spiritual ritual.", bestSeason: "Oct–Mar" },
  { id: "char-dham", name: "Char Dham Yatra", region: "Uttarakhand", image: "/images/spiritual/char-dham.jpg", blurb: "The sacred circuit of Yamunotri, Gangotri, Kedarnath and Badrinath — the quintessential Himalayan pilgrimage.", bestSeason: "Apr–Oct" },
  { id: "vaishno-devi", name: "Vaishno Devi", region: "Jammu & Kashmir", image: "/images/spiritual/vaishno-devi.jpg", blurb: "Mountain shrine reached by a scenic trek to the holy cave of Mata Vaishno Devi.", bestSeason: "Mar–Oct" },
  { id: "rameswaram", name: "Rameshwaram", region: "Tamil Nadu", image: "/images/spiritual/rameswaram.jpg", blurb: "Ramanathaswamy Temple and sacred island pilgrimage — rich in mythology and ritual.", bestSeason: "Nov–Mar" },
  { id: "puri", name: "Puri (Jagannath)", region: "Odisha", image: "/images/spiritual/puri.jpg", blurb: "One of the Char Dham pilgrimage sites — famous for Rath Yatra and seaside temple traditions.", bestSeason: "Oct–Feb" },
  { id: "bodh-gaya", name: "Bodh Gaya", region: "Bihar", image: "/images/spiritual/bodh-gaya.jpg", blurb: "Where Lord Buddha attained enlightenment beneath the Bodhi Tree — a UNESCO World Heritage site.", bestSeason: "Oct–Mar" },
  { id: "amarnath", name: "Amarnath Cave", region: "Jammu & Kashmir", image: "/images/spiritual/amarnath.jpg", blurb: "High-altitude Shiva cave shrine with seasonal pilgrimage and spectacular Himalayan scenery.", bestSeason: "Jun–Aug" },
  { id: "shirdi", name: "Shirdi (Sai Baba)", region: "Maharashtra", image: "/images/spiritual/shirdi.jpg", blurb: "Pilgrimage town devoted to Sai Baba — deep communal faith and large darshan crowds.", bestSeason: "Oct–Mar" },
  { id: "kanyakumari", name: "Kanyakumari", region: "Tamil Nadu", image: "/images/spiritual/kanyakumari.jpg", blurb: "Southern tip of India — Vivekananda Rock Memorial, sunrise/sunset views and coastal shrines.", bestSeason: "Oct–Feb" },
  { id: "haridwar", name: "Haridwar", region: "Uttarakhand", image: "/images/spiritual/haridwar.jpg", blurb: "Gateway to the Himalayas and the site of the holy Ganga aarti and Kumbh festivities.", bestSeason: "Oct–Mar" },
  { id: "rishikesh", name: "Rishikesh", region: "Uttarakhand", image: "/images/spiritual/rishikesh.jpg", blurb: "Yoga capital with ashrams, meditation centers and river experiences.", bestSeason: "Sep–Nov, Feb–Apr" },
  { id: "tirupati", name: "Tirupati (Venkateswara)", region: "Andhra Pradesh", image: "/images/spiritual/tirupati.jpg", blurb: "One of the busiest and most revered temple complexes in India.", bestSeason: "Oct–Feb" },
  { id: "amritsar", name: "Amritsar (Golden Temple)", region: "Punjab", image: "/images/spiritual/amritsar.jpg", blurb: "Sri Harmandir Sahib — the spiritual and cultural center of Sikhism.", bestSeason: "Oct–Mar" },
  { id: "kedarnath", name: "Kedarnath", region: "Uttarakhand", image: "/images/spiritual/kedarnath.jpg", blurb: "Char Dham site with a dramatic mountain setting and deep devotion.", bestSeason: "May–Oct" },
  { id: "badrinath", name: "Badrinath", region: "Uttarakhand", image: "/images/spiritual/badrinath.jpg", blurb: "Important Vaishnav pilgrimage and part of the Char Dham circuit.", bestSeason: "May–Oct" },
  { id: "dwarka", name: "Dwarka", region: "Gujarat", image: "/images/spiritual/dwarka.jpg", blurb: "Ancient Krishna city on the coast, linked to Dwarkadhish temple and maritime legends.", bestSeason: "Oct–Feb" },
  { id: "mathura-vrindavan", name: "Mathura & Vrindavan", region: "Uttar Pradesh", image: "/images/spiritual/mathura.jpg", blurb: "Birthplace of Lord Krishna with colourful festivals and temple culture.", bestSeason: "Oct–Mar" },
  { id: "pushkar", name: "Pushkar", region: "Rajasthan", image: "/images/spiritual/pushkar.jpg", blurb: "Holy lake, Brahma temple and nearby cultural attractions (camel fair season).", bestSeason: "Oct–Mar" },
  { id: "sabarimala", name: "Sabarimala", region: "Kerala", image: "/images/spiritual/sabarimala.jpg", blurb: "Pilgrimage to Lord Ayyappa with seasonal restrictions and hill trek.", bestSeason: "Nov–Jan" },
  { id: "madurai", name: "Madurai (Meenakshi Amman)", region: "Tamil Nadu", image: "/images/spiritual/madurai.jpg", blurb: "Grand Meenakshi temple complex with ornate gopurams and vibrant rituals.", bestSeason: "Oct–Mar" },
  { id: "ajmer", name: "Ajmer (Dargah Sharif)", region: "Rajasthan", image: "/images/spiritual/ajmer.jpg", blurb: "Renowned Sufi shrine that attracts pilgrims of many faiths.", bestSeason: "Oct–Mar" },
];

const cardVariants: Variants = {
  offscreen: { opacity: 0, y: 16 },
  onscreen: { opacity: 1, y: 0, transition: { type: "spring" as const, bounce: 0.08, duration: 0.6 } },
};

export default function SpiritualIndexPage() {
  return (
    <main className="bg-white text-slate-900">
      {/* HERO */}
      <section className="relative h-[56vh] md:h-[64vh] overflow-hidden rounded-b-2xl">
        <Image src="/images/spiritual/spiritual-hero.jpg" alt="Spiritual tourism" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 text-white">
          <h1 className="text-4xl md:text-6xl font-extrabold">Spiritual Tourism in India</h1>
          <p className="mt-4 max-w-3xl text-lg text-emerald-100">
            Curated pilgrimages, sacred circuits and restorative spiritual retreats across India.
          </p>

          <div className="mt-6 flex gap-3">
            <Link href="/spiritual/plan" className="inline-flex items-center gap-3 bg-amber-400 text-black px-5 py-3 rounded-2xl font-semibold shadow-lg hover:brightness-95 transition">
              Build Itinerary
            </Link>

            <button onClick={() => window.dispatchEvent(new Event("open-planner"))} className="inline-flex items-center gap-3 border border-white/30 text-white px-5 py-3 rounded-2xl font-semibold hover:bg-white/10 transition">
              Plan With Us
            </button>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="py-12 md:py-16 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Spiritual Journeys?</h2>
            <p className="text-gray-700 mb-4">
              Pilgrimages blend cultural heritage, ritual, and introspection — perfect for seekers, families and study tours.
            </p>
            <ul className="grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
              <li className="p-3 bg-emerald-50 rounded">Guided rituals & pujas</li>
              <li className="p-3 bg-emerald-50 rounded">Comfortable pilgrimage stays</li>
              <li className="p-3 bg-emerald-50 rounded">Logistics & permits handled</li>
              <li className="p-3 bg-emerald-50 rounded">Group & private departures</li>
            </ul>
          </div>
          <div className="rounded-xl overflow-hidden shadow-lg bg-white p-1">
            <Image src="/images/spiritual/temple-collage.jpg" alt="temples" width={1200} height={800} className="object-cover w-full h-64 sm:h-80" />
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="py-8 px-6 md:px-12 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-center">Popular Pilgrimage Destinations</h2>
        <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {PLACES.map((p) => (
            <motion.article
              key={p.id}
              className="bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 hover:shadow-lg transition"
              initial="offscreen"
              whileInView="onscreen"
              viewport={{ once: true, amount: 0.2 }}
              variants={cardVariants}
            >
              <div className="relative h-52">
                <Image src={p.image} alt={p.name} fill className="object-cover" />
              </div>
              <div className="p-5 flex flex-col gap-2">
                <h3 className="text-xl font-semibold text-emerald-800">{p.name}</h3>
                {p.region && <div className="text-sm text-gray-500">{p.region}</div>}
                <p className="text-gray-700 text-sm mt-2 flex-1">{p.blurb}</p>
                {p.bestSeason && <div className="text-xs text-gray-500">Best: {p.bestSeason}</div>}
                <div className="mt-3 flex gap-2">
                  <Link href={`/spiritual/${slugify(p.id)}`} className="px-4 py-2 rounded-full bg-amber-400 text-black text-sm font-semibold hover:brightness-95">
                    View Itinerary
                  </Link>
                  <button
                    onClick={() => window.dispatchEvent(new Event("open-planner"))}
                    className="px-4 py-2 rounded-full border border-emerald-200 text-emerald-800 text-sm hover:bg-emerald-50"
                  >
                    Plan & Book
                  </button>
                </div>
              </div>
            </motion.article>
          ))}

          {/* Final custom itinerary card */}
          <motion.article
            initial="offscreen"
            whileInView="onscreen"
            viewport={{ once: true, amount: 0.2 }}
            variants={cardVariants}
            className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-6 shadow-md border border-amber-100"
          >
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h4 className="text-xl font-bold text-emerald-900">Custom Itinerary & Bookings</h4>
                <p className="text-sm text-gray-600 mt-2">
                  Don’t see the pilgrimage you want? Tell us your dates and interests and we’ll craft a personalized spiritual itinerary with travel, stays and rituals included.
                </p>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => window.dispatchEvent(new Event("open-planner"))} className="px-4 py-2 rounded-full bg-emerald-800 text-white font-semibold">
                    Contact Travel Expert
                  </button>
                  <Link href="/spiritual/plan" className="px-4 py-2 rounded-full border border-emerald-800 text-emerald-800">
                    Request Itinerary
                  </Link>
                </div>
              </div>
              <div className="w-36 h-36 rounded-lg overflow-hidden hidden md:block">
                <Image src="/images/spiritual/custom-itinerary.jpg" alt="custom plan" width={192} height={192} className="object-cover" />
              </div>
            </div>
          </motion.article>
        </div>
      </section>

      {/* include planner modal (listens for "open-planner") */}
      <PlannerModal />

      {/* CTA */}
      <section className="py-14 bg-gradient-to-r from-emerald-700 to-emerald-900 text-white text-center">
        <h2 className="text-3xl font-bold mb-3">Ready for a Spiritual Journey?</h2>
        <p className="mb-6 text-emerald-100">Share your pilgrimage and dates — we'll create everything from permits to pujas.</p>
        <button onClick={() => window.dispatchEvent(new Event("open-planner"))} className="px-8 py-3 rounded-full bg-amber-400 text-black font-semibold">
          Get Free Consultation
        </button>
      </section>
    </main>
  );
}

// app/india/central/chhattisgarh/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

/**
 * Chhattisgarh index page — lists major destinations, quick actions to:
 * - auto-create an itinerary (opens the global itinerary builder.
 * - open contact modal for a personalised itinerary (dispatches global event "open-contact-expert")
 *
 * Follows the same structure/pattern used across other state pages (Bihar / Madhya Pradesh).
 */

const DATA = {
  name: "Chhattisgarh",
  image: "/images/central-india/chhattisgarh.jpg",
  bestSeason: "Oct – Feb",
  highlights:
    "Chhattisgarh — rich in waterfalls, dense forests, tribal culture, archaeological sites and wildlife corridors. Ideal for nature lovers and cultural travellers.",
};

const LOCATIONS = [
  "Raipur (Capital & civic hub)",
  "Bhilai (Steel city & gateway)",
  "Bilaspur (Rail & cultural centre)",
  "Jagdalpur (Bastar headquarters & gateway to waterfalls)",
  "Bastar region (Tribal culture, handicrafts & festivals)",
  "Chitrakote Falls (Broad cascade on River Indravati)",
  "Tirathgarh Falls (Multi-tiered scenic waterfall)",
  "Kondagaon (Handicrafts & bell metal work)",
  "Dantewada (Cultural gateway & rural landscapes)",
  "Kanker (Palaces, forest lodges & tribal art)",
  "Kawardha (Historical forts & natural areas)",
  "Achanakmar Wildlife Sanctuary (Tiger & forest reserve)",
  "Indravati National Park (Remote tiger habitat — permit required)",
  "Barnawapara Wildlife Sanctuary (Easy-access wildlife area)",
  "Sirpur (Archaeological sites & Buddhist remains)",
  "Rajim (Confluence & temples — 'Prayag of Chhattisgarh')",
  "Dongargarh (Baba Bamleshwari temple & hill views)",
  "Korba (Coal belt & nearby forest pockets)",
  "Raigarh (Cultural events & pottery traditions)",
  "Ambikapur (Northern highlands, scenic drives)",
  "Mahasamund (River ghats & agricultural towns)",
  "Gariaband (Rivers & waterfalls, quiet rural stays)",
  "Narayanpur (Rural Bastar access & tribal markets)",
  "Koriya (Hilly tracts & forest escapes)",
];

const DOS = [
  "Respect tribal customs and local practices when visiting villages and markets.",
  "Hire local guides for forest or wildlife visits — they improve safety and local income.",
  "Carry water, insect repellent and basic first-aid for waterfall/forest excursions.",
  "Book permits and authorised guides for remote parks like Indravati; follow park rules.",
];

const DONT_S = [
  "Don't stray off marked trails in wildlife sanctuaries — risk to both you and wildlife.",
  "Avoid photographing people in villages without asking permission.",
  "Don't attempt remote waterfall treks in monsoon (Jun–Sep) due to flash floods and slippery rocks.",
  "Avoid buying or transporting artefacts that might be protected or restricted — prefer licensed handicraft sellers.",
];

export default function ChhattisgarhPage() {
  const openContact = () => window.dispatchEvent(new Event("open-contact-expert"));

  const openPlannerWith = (state: string, location?: string) => {
    try {
      window.dispatchEvent(new CustomEvent("open-planner-with", { detail: { state, location } }));
    } catch {
      // noop
    }
  };

  const createItineraryAuto = () => openPlannerWith(DATA.name);

  return (
    <main className="bg-white text-slate-800 min-h-screen">
      {/* HERO */}
      <section className="relative w-full h-[56vh] md:h-[64vh] overflow-hidden rounded-b-2xl shadow-lg">
        <Image src={DATA.image} alt={DATA.name} fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/30 to-transparent" />
        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="max-w-3xl text-white">
            <h1 className="text-4xl md:text-5xl font-extrabold">{DATA.name}</h1>
            <p className="mt-3 text-lg text-emerald-100">{DATA.highlights}</p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={createItineraryAuto}
                className="px-4 py-2 rounded-2xl bg-amber-400 text-black font-semibold"
              >
                Create Itinerary (Auto)
              </button>

              <button
                onClick={openContact}
                className="px-4 py-2 rounded-2xl border border-white/30 text-white"
              >
                Personalize Itinerary
              </button>
            </div>

            <div className="mt-3 text-sm text-emerald-100">
              Best season: <strong>{DATA.bestSeason}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <section className="py-12 px-6 container mx-auto max-w-6xl">
        <h2 className="text-2xl font-bold text-emerald-800 mb-4">About {DATA.name}</h2>
        <p className="text-gray-700 mb-4">
          {DATA.highlights} Best season: <strong>{DATA.bestSeason}</strong>.
        </p>

        {/* LOCATIONS GRID */}
        <div className="mb-8">
          <h3 className="font-semibold mb-3">Top Destinations in Chhattisgarh</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LOCATIONS.map((loc) => (
              <div key={loc} className="rounded-lg p-4 bg-white border border-gray-100 shadow-sm">
                <div className="font-medium text-emerald-800">{shortLabel(loc)}</div>
                <div className="text-sm text-gray-600 mt-1">{getShortDescriptionFor(loc)}</div>
                <div className="mt-3">
                  <button
                    onClick={() => openPlannerWith(DATA.name, shortLabel(loc))}
                    className="text-sm px-3 py-1 rounded-full border border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                  >
                    Plan {shortLabel(loc)}
                  </button>
                  <button
                    onClick={openContact}
                    className="ml-2 text-sm px-3 py-1 rounded-full border border-amber-200 text-amber-700 hover:bg-amber-50"
                  >
                    Personalize
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DOs & DON'Ts */}
        <div className="mb-8 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-slate-50 p-6 border border-gray-100">
            <h4 className="font-semibold mb-3">Do's</h4>
            <ul className="list-disc pl-6 text-gray-700">
              {DOS.map((d) => (
                <li key={d} className="mb-2">
                  {d}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-slate-50 p-6 border border-gray-100">
            <h4 className="font-semibold mb-3">Don'ts</h4>
            <ul className="list-disc pl-6 text-gray-700">
              {DONT_S.map((d) => (
                <li key={d} className="mb-2">
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* FINAL CTA */}
        <div className="rounded-2xl bg-slate-50 p-6 border border-gray-100">
          <h4 className="font-semibold mb-2">Plan your Chhattisgarh trip</h4>
          <p className="text-gray-600 mb-4">
            From the waterfalls and tribal markets of Bastar to wildlife sanctuaries like Achanakmar and Indravati — tell us your travel style and dates,
            and we’ll craft a nature- and culture-first itinerary.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={createItineraryAuto}
              className="inline-flex items-center px-6 py-3 rounded-2xl bg-amber-400 text-black font-semibold"
            >
              Create Itinerary (Auto)
            </button>

            <button
              onClick={openContact}
              className="inline-flex items-center px-6 py-3 rounded-2xl border border-emerald-200 text-emerald-800"
            >
              Personalize Itinerary
            </button>

            <Link
              href="/india/central"
              className="inline-flex items-center px-6 py-3 rounded-2xl border border-emerald-200 text-emerald-800"
            >
              Back to Central India
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

/* Helper: shorten display name (remove parenthetical extra) */
function shortLabel(loc: string) {
  const match = loc.match(/^([^(,—]+)/);
  return match ? match[1].trim() : loc;
}

/* Short descriptions for major destinations */
function getShortDescriptionFor(loc: string) {
  const map: Record<string, string> = {
    "Raipur (Capital & civic hub)": "Administrative capital with civic amenities, markets and easy transport links.",
    "Bhilai (Steel city & gateway)": "Industrial city near Raipur; gateway to southern Chhattisgarh.",
    "Bilaspur (Rail & cultural centre)": "Important rail junction and cultural centre with temples and markets.",
    "Jagdalpur (Bastar headquarters & gateway to waterfalls)": "Base for exploring Bastar — markets, festivals and natural attractions.",
    "Bastar region (Tribal culture, handicrafts & festivals)": "Renowned for tribal art, Dussehra festivals and local handicrafts.",
    "Chitrakote Falls (Broad cascade on River Indravati)": "Impressive broad waterfall often called 'Niagara of India' — best after monsoon (Oct–Feb safer for visits).",
    "Tirathgarh Falls (Multi-tiered scenic waterfall)": "Photogenic multi-tiered falls within Kanger Valley area — good for short treks.",
    "Kondagaon (Handicrafts & bell metal work)": "Known for local crafts, bell-metalware and handloom products; good for buying authentic souvenirs.",
    "Dantewada (Cultural gateway & rural landscapes)": "Town serving rural Bastar areas with cultural markets and forest edge attractions.",
    "Kanker (Palaces, forest lodges & tribal art)": "Small town with a historic palace and access to forest lodges and tribal villages.",
    "Kawardha (Historical forts & natural areas)": "Town with forts and surrounding green areas — pleasant drives and local stays.",
    "Achanakmar Wildlife Sanctuary (Tiger & forest reserve)": "Protected area with tigers, leopards and rich forest ecology — guided safaris recommended.",
    "Indravati National Park (Remote tiger habitat — permit required)": "Remote tiger reserve with rugged terrain — requires planning and permits for visits.",
    "Barnawapara Wildlife Sanctuary (Easy-access wildlife area)": "Accessible sanctuary ideal for short safaris and birdwatching.",
    "Sirpur (Archaeological sites & Buddhist remains)": "Important archaeological complex with Buddhist viharas and historic ruins.",
    "Rajim (Confluence & temples — 'Prayag of Chhattisgarh')": "Temple town located at river confluence — important for rituals and festivals.",
    "Dongargarh (Baba Bamleshwari temple & hill views)": "Hill-top temple popular with pilgrims and easy day visits from Raipur.",
    "Korba (Coal belt & nearby forest pockets)": "Industrial town, also a staging point for nearby forest excursions.",
    "Raigarh (Cultural events & pottery traditions)": "Known for cultural festivals and local crafts.",
    "Ambikapur (Northern highlands, scenic drives)": "Gateway to northern hill tracts and scenic drives in Surguja region.",
    "Mahasamund (River ghats & agricultural towns)": "Riverfront towns and local markets that represent rural Chhattisgarh.",
    "Gariaband (Rivers & waterfalls, quiet rural stays)": "Emerging for quiet rural stays near rivers and small waterfalls.",
    "Narayanpur (Rural Bastar access & tribal markets)": "Entry point to remote tribal areas and local markets for handicrafts.",
    "Koriya (Hilly tracts & forest escapes)": "Hilly district with forested areas and less-crowded nature spots.",
  };
  return map[loc] || "Explore the cultural heritage, waterfalls and wildlife of this destination.";
}

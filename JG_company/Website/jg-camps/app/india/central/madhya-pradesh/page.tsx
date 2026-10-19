// app/india/central/madhya-pradesh/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

/**
 * Madhya Pradesh index page — lists major destinations, quick actions to:
 * - auto-create an itinerary (opens the global itinerary builder.
 * - open contact modal for a personalised itinerary (dispatches global event "open-contact-expert")
 *
 * Follows the same structure/pattern used across other state pages (Bihar / Tripura / Sikkim).
 */

const DATA = {
  name: "Madhya Pradesh",
  image: "/images/central-india/madhya-pradesh.jpg",
  bestSeason: "Oct – Mar",
  highlights:
    "Madhya Pradesh — the 'Heart of India' — blends UNESCO temples, central Indian national parks, fortress towns, hill stations and rich tribal & historic heritage.",
};

const LOCATIONS = [
  "Bhopal (Capital & Upper / Lower Lakes)",
  "Indore (Commercial hub & food trails)",
  "Gwalior (Gwalior Fort & palaces)",
  "Khajuraho (UNESCO temples & erotic carvings)",
  "Kanha National Park (Tigers & sal forests)",
  "Bandhavgarh National Park (High tiger density & forts)",
  "Pench National Park (Inspiration for The Jungle Book)",
  "Satpura National Park (Rugged landscapes & safaris)",
  "Pachmarhi (Hill station & waterfalls)",
  "Sanchi (Great Stupa & Buddhist site)",
  "Ujjain (Mahakaleshwar temple & Kumbh legacy)",
  "Orchha (Royal cenotaphs & riverside palaces)",
  "Mandu (Mausoleum & Jahaz Mahal ruins)",
  "Jabalpur (Bhedaghat marble rocks & Dhuandhar Falls)",
  "Maheshwar (Ghats, handloom sarees & Ahilya Fort)",
  "Rewa (White tiger origin & scenic plateaus)",
  "Chitrakoot (Pilgrimage & scenic waterfalls)",
  "Burhanpur (Historic mosques & textile history)",
  "Ratlam (Rail hub & local markets)",
  "Narmadapuram / Hoshangabad (Narmada riverfront & forests)",
  "Betul & Satpura foothills (Hill drives & tribal villages)",
  "Balaghat (Forest tracts & mineral belts)",
  "Damoh (Temples & natural spots)",
  "Seoni (Gateway to Pench & rural landscapes)",
];

const DOS = [
  "Plan wildlife visits with licensed guides and pre-booked safaris for Kanha/Bandhavgarh/Pench.",
  "Carry identity proof and follow park rules (no plastic, no off-trail wandering).",
  "Try local cuisine — dal bafla, poha (Indore), and tribal preparations in rural stays.",
  "Visit heritage sites early morning or late afternoon for best light and cooler temperatures.",
];

const DONT_S = [
  "Don't attempt night drives in parks unless organised by park authorities.",
  "Avoid touching or climbing on protected temple carvings at Khajuraho and Sanchi.",
  "Don't stray into restricted areas near forts and archaeological sites.",
  "Avoid disrespectful photography at certain pilgrimage sites; follow local rules.",
];

export default function MadhyaPradeshPage() {
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
          <h3 className="font-semibold mb-3">Top Destinations in Madhya Pradesh</h3>
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
          <h4 className="font-semibold mb-2">Plan your Madhya Pradesh trip</h4>
          <p className="text-gray-600 mb-4">
            From tiger safaris in Kanha and Bandhavgarh to the UNESCO temples of Khajuraho and the historical towns of Gwalior and Orchha —
            tell us your travel style and dates, and we’ll craft a memorable central-India itinerary.
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
    "Bhopal (Capital & Upper / Lower Lakes)": "Capital city with lakes, museums (Birla Museum) and nearby Sanchi stupa access.",
    "Indore (Commercial hub & food trails)": "Madhya Pradesh’s largest city — famous for food streets, Rajwada and bustling bazaars.",
    "Gwalior (Gwalior Fort & palaces)": "Imperial fort, palaces and rich Maratha/Scindia heritage with sound-and-light shows.",
    "Khajuraho (UNESCO temples & erotic carvings)": "World-famous temple complex with intricate stone carvings and a major cultural festival.",
    "Kanha National Park (Tigers & sal forests)": "Large central-Indian park with tigers, barasingha and well-managed safari circuits.",
    "Bandhavgarh National Park (High tiger density & forts)": "Known for excellent tiger sightings and historic Bandhavgarh fort.",
    "Pench National Park (Inspiration for The Jungle Book)": "Scenic park with diverse wildlife and good safari infrastructure.",
    "Satpura National Park (Rugged landscapes & safaris)": "Less-crowded park with walking safaris, boat rides and varied terrain.",
    "Pachmarhi (Hill station & waterfalls)": "Satpura hill station with viewpoints, caves and waterfalls — a popular summer retreat.",
    "Sanchi (Great Stupa & Buddhist site)": "Ancient Buddhist stupas and archaeological museum — excellent for history lovers.",
    "Ujjain (Mahakaleshwar temple & Kumbh legacy)": "Important pilgrimage city with Mahakaleshwar Temple and river rituals on the Shipra.",
    "Orchha (Royal cenotaphs & riverside palaces)": "Picturesque medieval town with palaces, cenotaphs and riverfront charm.",
    "Mandu (Mausoleum & Jahaz Mahal ruins)": "Ruined city with romantic architecture, Jahaz Mahal and Jahangir Mahal.",
    "Jabalpur (Bhedaghat marble rocks & Dhuandhar Falls)": "Riverine scenery with marble rocks, waterfalls and boat rides on the Narmada.",
    "Maheshwar (Ghats, handloom sarees & Ahilya Fort)": "Riverside town famed for handloom Maheshwari sarees and Ahilya Fort.",
    "Rewa (White tiger origin & scenic plateaus)": "Known historically for the first white tiger and scenic uplands.",
    "Chitrakoot (Pilgrimage & scenic waterfalls)": "Sacred site with falls, temples and mythological significance.",
    "Burhanpur (Historic mosques & textile history)": "Mughal-era town with notable mosques and trade history.",
    "Ratlam (Rail hub & local markets)": "Market town with railway connectivity and culinary stops.",
    "Narmadapuram / Hoshangabad (Narmada riverfront & forests)": "Riverfront town on the Narmada with forested surroundings.",
    "Betul & Satpura foothills (Hill drives & tribal villages)": "Gateway to Satpura with rural stays and forest trails.",
    "Balaghat (Forest tracts & mineral belts)": "Eastern MP district with forested areas and tribal culture.",
    "Damoh (Temples & natural spots)": "Town with historic temples and access to nearby nature.",
    "Seoni (Gateway to Pench & rural landscapes)": "Town close to Pench National Park and rural Maharashtra border areas.",
  };
  return map[loc] || "Discover the history, wildlife and natural beauty of this destination.";
}

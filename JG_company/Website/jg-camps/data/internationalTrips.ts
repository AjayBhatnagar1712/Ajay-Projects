export type InternationalTrip = {
  slug: string;
  title: string;
  category: string;
  duration: string;
  season: string;
  image: string;
  description: string;
  highlights: string[];
  pace: string[];
};

export const INTERNATIONAL_TRIPS: InternationalTrip[] = [
  {
    slug: "europe-highlights",
    title: "Europe Highlights",
    category: "Europe",
    duration: "8-12 days",
    season: "Apr-Jun, Sep-Oct",
    image: "/images/International/europe-highlights.jpg",
    description: "A polished first-Europe loop across iconic capitals, scenic trains, lakes, food streets, and landmark experiences.",
    highlights: ["Paris city icons", "Swiss mountain day", "Italian old towns", "Museum and food walks"],
    pace: ["2-3 nights per major stop", "Train-first routing where practical", "Optional premium transfers and guides"],
  },
  {
    slug: "swiss-alps",
    title: "Swiss Alps Getaway",
    category: "Europe",
    duration: "5-8 days",
    season: "May-Oct, Dec-Feb",
    image: "/images/International/swiss-alps.jpg",
    description: "Lakes, alpine rail routes, glacier viewpoints, and relaxed village stays for scenic travelers.",
    highlights: ["Alpine rail journeys", "Lake cruises", "Glacier viewpoints", "Cheese and chocolate trails"],
    pace: ["Slow scenic routing", "Weather-aware mountain days", "Balanced activity and rest"],
  },
  {
    slug: "bali",
    title: "Bali & Beyond",
    category: "Southeast Asia",
    duration: "6-9 days",
    season: "Apr-Oct",
    image: "/images/International/bali.jpg",
    description: "Beaches, temples, rice terraces, waterfalls, and soft adventure across Bali and nearby islands.",
    highlights: ["Ubud culture", "Temple sunsets", "Waterfalls", "Island day trips"],
    pace: ["Beach plus culture split", "Private transfers recommended", "Flexible family or honeymoon pacing"],
  },
  {
    slug: "thailand",
    title: "Thailand Explorer",
    category: "Southeast Asia",
    duration: "6-10 days",
    season: "Nov-Mar",
    image: "/images/International/thailand.jpg",
    description: "Bangkok energy, island downtime, night markets, temples, and optional northern culture routes.",
    highlights: ["Bangkok food streets", "Island beaches", "Temple visits", "Market evenings"],
    pace: ["City plus beach split", "Optional adventure add-ons", "Easy group-friendly logistics"],
  },
  {
    slug: "dubai",
    title: "Dubai Luxe Break",
    category: "Middle East",
    duration: "4-6 days",
    season: "Nov-Mar",
    image: "/images/International/dubai.jpg",
    description: "Skyline views, desert experiences, premium shopping, family attractions, and polished short-break logistics.",
    highlights: ["Desert safari", "Marina evenings", "Observation decks", "Theme parks"],
    pace: ["Compact city routing", "Premium transfer options", "Family and luxury friendly"],
  },
  {
    slug: "jordan",
    title: "Jordan Heritage Trail",
    category: "Middle East",
    duration: "6-8 days",
    season: "Mar-May, Sep-Nov",
    image: "/images/International/jordan.jpg",
    description: "Petra, Wadi Rum, ancient routes, desert stays, and the Dead Sea in one deeply textured journey.",
    highlights: ["Petra walk", "Wadi Rum desert", "Dead Sea float", "Local heritage meals"],
    pace: ["Guided heritage focus", "Early starts for key sites", "Desert night optional"],
  },
  {
    slug: "alps-trek",
    title: "Alps Adventure Trek",
    category: "Adventure",
    duration: "7-10 days",
    season: "Jun-Sep",
    image: "/images/International/alps-trek.jpg",
    description: "A high-scenery trekking route with mountain villages, cable cars, glacier views, and support planning.",
    highlights: ["Guided day hikes", "Glacier viewpoints", "Mountain villages", "Recovery evenings"],
    pace: ["Moderate to active", "Rest day built in", "Weather-buffered route design"],
  },
  {
    slug: "new-zealand",
    title: "New Zealand Road Trip",
    category: "Adventure",
    duration: "10-14 days",
    season: "Nov-Apr",
    image: "/images/International/new-zealand.jpg",
    description: "Epic drives, fjords, lakes, adventure towns, and nature-first pacing across dramatic landscapes.",
    highlights: ["Scenic self-drive", "Fjord cruise", "Adventure activities", "Lake towns"],
    pace: ["Road trip rhythm", "2-night anchor stops", "Adventure add-ons by comfort level"],
  },
  {
    slug: "med-yacht",
    title: "Mediterranean Yacht Week",
    category: "Luxury",
    duration: "5-8 days",
    season: "May-Sep",
    image: "/images/International/med-yacht.jpg",
    description: "Island-hopping, coastal dining, swim stops, marina evenings, and premium private-group planning.",
    highlights: ["Island hopping", "Private yacht day", "Coastal dining", "Sunset ports"],
    pace: ["Slow luxury pacing", "Weather-aware sail days", "Concierge-style coordination"],
  },
  {
    slug: "maldives",
    title: "Maldives Overwater Escape",
    category: "Luxury",
    duration: "4-7 days",
    season: "Nov-Apr",
    image: "/images/International/maldives.jpg",
    description: "Turquoise lagoons, snorkeling, spa time, private dinners, and calm premium escape planning.",
    highlights: ["Lagoon stay", "Snorkeling", "Sunset cruise", "Slow leisure time"],
    pace: ["Minimal transfers", "Rest-first design", "Honeymoon and family variants"],
  },
];

export function getInternationalTrip(slug: string) {
  return INTERNATIONAL_TRIPS.find((trip) => trip.slug === slug);
}

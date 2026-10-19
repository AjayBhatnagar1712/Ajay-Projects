// app/group-retreats/plan/page.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ItineraryDisplay from "@/components/ItineraryDisplay";

/**
 * This planner is tailored for group retreats:
 * Steps: Group size, Trip type, Dates, Locations, Activities, Budget, Review
 *
 * Images are not required for the planner page; hero and cards are on listing page.
 */

const steps = ["Group size", "Trip Type", "Dates", "Locations", "Activities", "Budget", "Review"] as const;

const TRIP_TYPES = ["Corporate Offsite", "Training / Workshop", "School Camp", "College Program", "Family Group", "Open Tour", "Spiritual / Pilgrimage", "Custom"] as const;

const SAMPLE_LOCATIONS = ["Hill Station", "Beach Camp", "Backwater / Lake", "Wilderness / Jungle", "Heritage City (forts)", "Monastery / Ashram"];

export default function GroupRetreatsPlan() {
  const [currentStep, setCurrentStep] = useState(0);
  const [groupSize, setGroupSize] = useState("");
  const [tripType, setTripType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [customActivity, setCustomActivity] = useState("");
  const [budget, setBudget] = useState("");

  const [showItinerary, setShowItinerary] = useState(false);
  const [itineraryText, setItineraryText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const canGoNext = () => {
    if (currentStep === 0) return !!groupSize;
    if (currentStep === 1) return !!tripType;
    if (currentStep === 2) return !!startDate && !!endDate && new Date(endDate) > new Date(startDate);
    if (currentStep === 3) return selectedLocations.length > 0;
    if (currentStep === 4) return selectedActivities.length > 0 || customActivity.trim().length > 0;
    if (currentStep === 5) return !!budget;
    return true;
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
      return;
    }

    setGenError(null);
    setGenerating(true);

    try {
      const result = await buildAIItinerary();
      setItineraryText(result);
      setShowItinerary(true);
    } catch (err: any) {
      console.error("AI itinerary error:", err);
      setGenError(err?.message || "Failed to generate itinerary. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  const toggleLocation = (l: string) => {
    setSelectedLocations((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  };

  const toggleActivity = (a: string) => {
    setSelectedActivities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const canGenerate = () => canGoNext();

  async function buildAIItinerary(): Promise<string> {
    const nights = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
    const locs = selectedLocations.join(", ") || "locations as discussed";
    const acts = [...selectedActivities, ...(customActivity.trim() ? [customActivity.trim()] : [])].join(", ") || "standard group activities";

    const systemPrompt = `You are a professional travel planner for Journey Gate specialising in group retreats and programs.
Rules:
- DO NOT mention or recommend any hotel, resort, Airbnb, or stay property by name.
- If you would otherwise recommend a property, instead say:
  "For stay bookings and accommodation options, contact Journey Gate at 📞 8595167227 / 8076874156 or ✉️ jgadven@gmail.com."
- Produce a clear Markdown itinerary with Day 1 / Day 2 / etc (show nights per location).
- For each day include: travel time (approx), 1–3 activity highlights, and one food/meal suggestion.
- Include a short cost guidance for groups (Economy / Mid / Premium).
- End the output with a one-line summary encouraging the user to contact Journey Gate for bookings.
- Keep the itinerary concise and formatted for display on the web (use bullet lists).`;

    const userPrompt = `Plan a ${nights}-night group ${tripType || "retreat"} for ~${groupSize} participants.
Dates: ${startDate} → ${endDate}
Locations: ${locs}
Activities / focus: ${acts}
Budget: ${budget || "flexible"}
Please propose a practical route, nights per stop, and a sample daily programme.`;

    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
          maxOutputTokens: 1100,
          temperature: 0.5,
          timeoutMs: 18000,
        }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    if (!data?.reply) throw new Error("No AI reply");
    return data.reply;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900">Build Your Group Retreat</h1>
        <p className="text-lg text-gray-600 mt-3">Quickly craft a sample programme and cost guidance for your group — then request a detailed quote from our experts.</p>
      </div>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
        {!showItinerary ? (
          <motion.div key={currentStep} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {currentStep === 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Group size (approx)</h2>
                <div className="flex flex-wrap gap-3">
                  {["6-12", "15-30", "30-60", "60+"].map((s) => (
                    <Button key={s} variant={groupSize === s ? "default" : "outline"} onClick={() => setGroupSize(s)}>
                      {s} participants
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Trip type</h2>
                <div className="flex flex-wrap gap-3">
                  {TRIP_TYPES.map((t) => (
                    <Button key={t} variant={tripType === t ? "default" : "outline"} onClick={() => setTripType(t)}>
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Dates</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border px-3 py-2" />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border px-3 py-2" />
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Locations / settings</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SAMPLE_LOCATIONS.map((l) => (
                    <label key={l} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      <input type="checkbox" checked={selectedLocations.includes(l)} onChange={() => toggleLocation(l)} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Activities / focus</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {["Team-building", "Workshops", "Adventure & Trek", "Leadership Retreats", "Cultural Immersion", "Community Service"].map((a) => (
                    <label key={a} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      <input type="checkbox" checked={selectedActivities.includes(a)} onChange={() => toggleActivity(a)} />
                      <span>{a}</span>
                    </label>
                  ))}
                </div>
                <input value={customActivity} onChange={(e) => setCustomActivity(e.target.value)} placeholder="Add custom activity" className="w-full border rounded-lg px-3 py-2" />
              </div>
            )}

            {currentStep === 5 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Budget / per person</h2>
                <div className="flex flex-wrap gap-3">
                  {["Economy", "Mid", "Premium"].map((b) => (
                    <Button key={b} variant={budget === b ? "default" : "outline"} onClick={() => setBudget(b)}>
                      {b}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 6 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Review selections</h2>
                <ul className="text-gray-700 space-y-2">
                  <li><strong>Group size:</strong> {groupSize || "—"}</li>
                  <li><strong>Trip type:</strong> {tripType || "—"}</li>
                  <li><strong>Dates:</strong> {startDate && endDate ? `${startDate} → ${endDate}` : "—"}</li>
                  <li><strong>Locations:</strong> {selectedLocations.join(", ") || "—"}</li>
                  <li><strong>Activities:</strong> {selectedActivities.join(", ") || customActivity || "—"}</li>
                  <li><strong>Budget:</strong> {budget || "—"}</li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">AI will generate a concise group itinerary based on these inputs.</p>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 0 || generating}>Back</Button>
              <Button onClick={handleNext} disabled={!canGoNext() || generating}>
                {generating ? "Generating..." : currentStep === steps.length - 1 ? "Generate Itinerary" : "Next"}
              </Button>
            </div>

            {genError && <p className="mt-3 text-sm text-red-600">{genError}</p>}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h2 className="text-2xl font-bold mb-4 text-center">Your Group Retreat Itinerary</h2>
            <ItineraryDisplay itinerary={itineraryText} />
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setShowItinerary(false)}>Edit Preferences</Button>
              <a href="tel:+918595167227" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700">📞 8595167227</a>
              <a href="mailto:jgadven@gmail.com" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-yellow-500 text-black hover:bg-yellow-400">✉️ jgadven@gmail.com</a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

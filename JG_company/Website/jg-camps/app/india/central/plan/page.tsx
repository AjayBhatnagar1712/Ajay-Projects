"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ItineraryDisplay from "@/components/ItineraryDisplay";

/**
 * CENTRAL INDIA TRIP PLANNER
 * Generates AI itineraries using Gemini via /api/gemini
 * Rules:
 * - Never name hotels/resorts directly.
 * - Always refer users to Journey Gate for bookings.
 */

const steps = ["Duration", "Trip Type", "State", "Cities / Famous Spots", "Budget", "Review"];

const CENTRAL_STATES = ["Chhattisgarh", "Madhya Pradesh"] as const;

const POPULAR_SPOTS: Record<(typeof CENTRAL_STATES)[number], string[]> = {
  Chhattisgarh: ["Barnawapara", "Chitrakote Falls", "Kanger Valley", "Jagdalpur", "Tirathgarh Falls"],
  "Madhya Pradesh": ["Khajuraho", "Sanchi", "Bandhavgarh", "Kanha", "Pench", "Bhopal", "Gwalior"],
};

export default function CentralIndiaPlanTrip() {
  const [currentStep, setCurrentStep] = useState(0);
  const [duration, setDuration] = useState("");
  const [tripType, setTripType] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);
  const [customSpot, setCustomSpot] = useState("");
  const [budget, setBudget] = useState("");

  const [showItinerary, setShowItinerary] = useState(false);
  const [itineraryText, setItineraryText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const canGoNext = () => {
    if (currentStep === 0) return !!duration;
    if (currentStep === 1) return !!tripType;
    if (currentStep === 2) return selectedStates.length > 0;
    if (currentStep === 3) return selectedSpots.length > 0 || customSpot.trim().length > 0;
    if (currentStep === 4) return !!budget;
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
      const plan = await buildAIItinerary();
      setItineraryText(plan);
      setShowItinerary(true);
    } catch (err: any) {
      console.error("AI itinerary error:", err);
      setGenError(err?.message || "Failed to generate itinerary. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleBack = () => setCurrentStep((s) => Math.max(0, s - 1));

  const toggleState = (state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
    );
    if (selectedStates.includes(state)) {
      const toRemove = new Set(POPULAR_SPOTS[state as keyof typeof POPULAR_SPOTS] ?? []);
      setSelectedSpots((prev) => prev.filter((p) => !toRemove.has(p)));
    }
  };

  const toggleSpot = (spot: string) => {
    setSelectedSpots((prev) =>
      prev.includes(spot) ? prev.filter((s) => s !== spot) : [...prev, spot]
    );
  };

  const spotsFromSelectedStates = selectedStates.flatMap(
    (st) => POPULAR_SPOTS[st as keyof typeof POPULAR_SPOTS] || []
  );

  /** ✅ Gemini AI Integration for Central India */
  async function buildAIItinerary(): Promise<string> {
    const days = parseInt(duration) || 4;
    const allSpots = [...selectedSpots, ...(customSpot.trim() ? [customSpot.trim()] : [])];
    const stateList = selectedStates.join(", ") || "Central Indian states";
    const destinationList = allSpots.join(", ") || "Central Indian highlights";

    const systemPrompt = `You are a professional travel planner for **Journey Gate**, specializing in Central India.
Rules:
- DO NOT mention or recommend any hotel, resort, or property by name.
- Instead, write: "For stay bookings and accommodation options, contact Journey Gate at 📞 8595167227 / 8076874156 or ✉️ jgadven@gmail.com."
- Produce a well-structured Markdown itinerary ("Day 1", "Day 2", etc.)
- Include 2–3 attractions per day, brief travel times, and local food experiences.
- Mention cost tiers (Economy / Mid / Premium) with approximate INR ranges.
- End with a short line encouraging users to contact Journey Gate for bookings.`;

    const userPrompt = `Plan a ${days}-day ${tripType || "Central India"} itinerary.
States: ${stateList}
Places: ${destinationList}
Budget: ${budget || "flexible"}
Ensure a good balance of nature, culture, and comfort.`;

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
    if (!data?.reply) throw new Error("No AI reply received");
    return data.reply;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900">Build Your Central India Itinerary</h1>
        <p className="text-lg text-gray-600 mt-3">
          Generate a custom AI travel plan for Madhya Pradesh & Chhattisgarh — wildlife, waterfalls, heritage and more.
        </p>
      </div>

      {/* Step progress bar */}
      <div className="flex justify-center mb-8">
        {steps.map((step, i) => (
          <div
            key={step}
            className={`px-4 py-2 rounded-full mx-1 md:mx-2 text-sm md:text-base ${
              i === currentStep ? "bg-emerald-700 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            {step}
          </div>
        ))}
      </div>

      {/* Main wizard card */}
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
        {!showItinerary ? (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* Step 0: Duration */}
            {currentStep === 0 && (
              <Step title="How many days?">
                {["3", "4", "5", "7", "10+"].map((d) => (
                  <Button key={d} variant={duration === d ? "default" : "outline"} onClick={() => setDuration(d)}>
                    {d} Days
                  </Button>
                ))}
              </Step>
            )}

            {/* Step 1: Trip Type */}
            {currentStep === 1 && (
              <Step title="What kind of trip?">
                {["Adventure", "Cultural", "Wildlife", "Spiritual", "Family", "Leisure"].map((t) => (
                  <Button key={t} variant={tripType === t ? "default" : "outline"} onClick={() => setTripType(t)}>
                    {t}
                  </Button>
                ))}
              </Step>
            )}

            {/* Step 2: States */}
            {currentStep === 2 && (
              <Step title="Choose your state(s)">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CENTRAL_STATES.map((st) => (
                    <label key={st} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      <input type="checkbox" checked={selectedStates.includes(st)} onChange={() => toggleState(st)} />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </Step>
            )}

            {/* Step 3: Spots */}
            {currentStep === 3 && (
              <Step title="Select cities / famous spots">
                {spotsFromSelectedStates.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {spotsFromSelectedStates.map((spot) => (
                      <label key={spot} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                        <input type="checkbox" checked={selectedSpots.includes(spot)} onChange={() => toggleSpot(spot)} />
                        <span>{spot}</span>
                      </label>
                    ))}
                  </div>
                )}
                <input
                  value={customSpot}
                  onChange={(e) => setCustomSpot(e.target.value)}
                  placeholder="Add your own place (optional)"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </Step>
            )}

            {/* Step 4: Budget */}
            {currentStep === 4 && (
              <Step title="What’s your budget?">
                {["Economy", "Premium", "Luxury"].map((b) => (
                  <Button key={b} variant={budget === b ? "default" : "outline"} onClick={() => setBudget(b)}>
                    {b}
                  </Button>
                ))}
              </Step>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Review your selections</h2>
                <ul className="text-gray-700 space-y-2">
                  <li><strong>Duration:</strong> {duration || "—"} Days</li>
                  <li><strong>Trip Type:</strong> {tripType || "—"}</li>
                  <li><strong>States:</strong> {selectedStates.join(", ") || "—"}</li>
                  <li><strong>Places:</strong> {selectedSpots.join(", ") || customSpot || "—"}</li>
                  <li><strong>Budget:</strong> {budget || "—"}</li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">AI will generate a detailed itinerary tailored for Central India.</p>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={handleBack} disabled={currentStep === 0 || generating}>
                Back
              </Button>
              <Button onClick={handleNext} disabled={!canGoNext() || generating}>
                {generating
                  ? "Generating..."
                  : currentStep === steps.length - 1
                  ? "Generate Itinerary"
                  : "Next"}
              </Button>
            </div>

            {genError && <p className="mt-3 text-sm text-red-600">{genError}</p>}
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <h2 className="text-2xl font-bold mb-4 text-center">Your Central India Itinerary</h2>
            <ItineraryDisplay itinerary={itineraryText} />
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setShowItinerary(false)}>Edit Preferences</Button>
              <a href="tel:+918595167227" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700">
                📞 8595167227
              </a>
              <a href="tel:+918076874156" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700">
                📞 8076874156
              </a>
              <a href="mailto:jgadven@gmail.com" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-yellow-500 text-black hover:bg-yellow-400">
                ✉️ jgadven@gmail.com
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** Step wrapper */
function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

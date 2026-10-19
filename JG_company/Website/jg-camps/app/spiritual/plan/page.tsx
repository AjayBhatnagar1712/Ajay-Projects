// app/spiritual/plan/page.tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import ItineraryDisplay from "@/components/ItineraryDisplay";

const steps = ["Duration", "Pilgrimage Type", "Destinations", "Specific Sites", "Budget", "Review"];

const PILGRIMAGE_TYPES = ["Char Dham", "Jyotirlinga", "Shakti Peeth / Mata Circuits", "Buddhist Trails", "Temple Trail", "Custom"] as const;

const SPIRITUAL_PLACES = [
  "Varanasi (Kashi)",
  "Char Dham (Yamunotri, Gangotri, Kedarnath, Badrinath)",
  "Vaishno Devi",
  "Rameshwaram",
  "Puri (Jagannath)",
  "Bodh Gaya",
  "Amarnath",
  "Shirdi",
  "Kanyakumari",
  "Haridwar",
  "Rishikesh",
  "Tirupati",
  "Amritsar",
  "Kedarnath",
  "Badrinath",
  "Dwarka",
  "Mathura & Vrindavan",
  "Pushkar",
  "Sabarimala",
  "Madurai",
  "Ajmer",
] as const;

export default function SpiritualPlanPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [duration, setDuration] = useState("");
  const [tripType, setTripType] = useState("");
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [customPlace, setCustomPlace] = useState("");
  const [budget, setBudget] = useState("");
  const [showItinerary, setShowItinerary] = useState(false);
  const [itineraryText, setItineraryText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const canGoNext = () => {
    if (currentStep === 0) return !!duration;
    if (currentStep === 1) return !!tripType;
    if (currentStep === 2) return selectedPlaces.length > 0 || customPlace.trim().length > 0;
    if (currentStep === 3) return true; // optional finer selection
    if (currentStep === 4) return !!budget;
    return true;
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
      return;
    }

    // generate AI itinerary
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

  const togglePlace = (place: string) => {
    setSelectedPlaces((prev) => (prev.includes(place) ? prev.filter((p) => p !== place) : [...prev, place]));
  };

  const placesFromSelection = selectedPlaces;

  async function buildAIItinerary(): Promise<string> {
    const days = parseInt(duration) || 5;
    const places = [...selectedPlaces, ...(customPlace.trim() ? [customPlace.trim()] : [])];
    const placeList = places.join(", ") || tripType || "spiritual highlights";
    const systemPrompt = `You are a professional travel planner for Journey Gate. Produce a useful, travel-friendly, and culturally respectful itinerary for spiritual pilgrimages in India.
Rules:
- Do NOT recommend specific hotels by name; instead say "contact Journey Gate for accommodation options".
- Provide Day-by-day headings (Day 1, Day 2...), approximate travel times, 2-3 activity highlights each day, and small notes on rituals/attire/permits when relevant.
- Provide short cost guidance (Economy / Mid / Premium), avoid luxury brand names.
- End with a short CTA encouraging contact for bookings and puja arrangements.`;

    const userPrompt = `Create a ${days}-day itinerary focused on: ${placeList}. Trip type: ${tripType || "Spiritual"}. Budget: ${budget || "Flexible"}. Consider accessibility and travel-friendly pacing.`;

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

    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    if (!data?.reply) throw new Error("No AI reply");
    return data.reply;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900">Plan a Spiritual Pilgrimage</h1>
        <p className="text-lg text-gray-600 mt-3">
          Build a tailored pilgrimage plan — Char Dham, Jyotirlinga circuits, Buddhist trails or a custom temple tour.
        </p>
      </div>

      {/* Step progress */}
      <div className="flex justify-center mb-8">
        {steps.map((s, i) => (
          <div key={s} className={`px-4 py-2 rounded-full mx-1 ${i === currentStep ? "bg-emerald-700 text-white" : "bg-gray-200 text-gray-700"}`}>
            {s}
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-lg">
        {!showItinerary ? (
          <motion.div key={currentStep} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {/* Duration */}
            {currentStep === 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">How many days?</h2>
                <div className="flex flex-wrap gap-3">
                  {["2", "3", "4", "6", "8", "10+"].map((d) => (
                    <Button key={d} variant={duration === d ? "default" : "outline"} onClick={() => setDuration(d)}>{d} Days</Button>
                  ))}
                </div>
              </div>
            )}

            {/* Pilgrimage type */}
            {currentStep === 1 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Pilgrimage Type</h2>
                <div className="flex flex-wrap gap-3">
                  {PILGRIMAGE_TYPES.map((t) => (
                    <Button key={t} variant={tripType === t ? "default" : "outline"} onClick={() => setTripType(t)}>{t}</Button>
                  ))}
                </div>
              </div>
            )}

            {/* Destinations */}
            {currentStep === 2 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Choose destinations (select many)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  {SPIRITUAL_PLACES.map((place) => (
                    <label key={place} className="flex items-center gap-2 border rounded-lg px-3 py-2">
                      <input type="checkbox" checked={selectedPlaces.includes(place)} onChange={() => togglePlace(place)} />
                      <span>{place}</span>
                    </label>
                  ))}
                </div>
                <input value={customPlace} onChange={(e) => setCustomPlace(e.target.value)} placeholder="Add custom place (e.g., local temple)" className="w-full border rounded-lg px-3 py-2" />
              </div>
            )}

            {/* Specific Sites (optional) */}
            {currentStep === 3 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Specific sites or rituals to include</h2>
                <p className="text-sm text-gray-600 mb-3">Example: Ganga aarti in Varanasi, Bhasma Aarti in Ujjain, special puja in Rameshwaram.</p>
                <div className="mb-3">
                  <textarea placeholder="List specific sites or rituals…" className="w-full border rounded-lg p-3" onChange={(e) => setCustomPlace(e.target.value)} value={customPlace} />
                </div>
              </div>
            )}

            {/* Budget */}
            {currentStep === 4 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Budget</h2>
                <div className="flex gap-3">
                  {["Economy", "Mid", "Premium"].map((b) => (
                    <Button key={b} variant={budget === b ? "default" : "outline"} onClick={() => setBudget(b)}>{b}</Button>
                  ))}
                </div>
              </div>
            )}

            {/* Review */}
            {currentStep === 5 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Review your selections</h2>
                <ul className="text-gray-700 space-y-2">
                  <li><strong>Duration:</strong> {duration || "—"} Days</li>
                  <li><strong>Pilgrimage Type:</strong> {tripType || "—"}</li>
                  <li><strong>Destinations:</strong> {placesFromSelection.join(", ") || customPlace || "—"}</li>
                  <li><strong>Budget:</strong> {budget || "—"}</li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">We will use this to generate a practical day-by-day pilgrimage plan.</p>
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
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <h2 className="text-2xl font-bold mb-4 text-center">Your Pilgrimage Itinerary</h2>
            <ItineraryDisplay itinerary={itineraryText} />
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => setShowItinerary(false)}>Edit Preferences</Button>
              <a href="tel:+918595167227" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700">📞 8595167227</a>
              <a href="tel:+918076874156" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700">📞 8076874156</a>
              <a href="mailto:jgadven@gmail.com" className="inline-flex items-center justify-center rounded-md px-4 py-2 bg-yellow-500 text-black hover:bg-yellow-400">✉️ jgadven@gmail.com</a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

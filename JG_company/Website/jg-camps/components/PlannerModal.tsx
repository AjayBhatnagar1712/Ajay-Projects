// components/PlannerModal.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import {
  X,
  Loader2,
  Calendar,
  MapPin,
  IndianRupee,
  Sparkles,
  Phone,
  Mail,
  ChevronRight,
  Plus,
  XCircle,
} from "lucide-react";

type Props = { open?: boolean; onClose?: () => void }; // made optional
type ItinState = "idle" | "loading" | "done" | "error";

function cleanDisplayText(value?: string) {
  return (value || "")
    .replace(/^[-*•\s]+/, "")
    .replace(/\*\*/g, "")
    .replace(/```(?:json)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSentence(value?: string, maxWords = 16) {
  const cleaned = cleanDisplayText(value);
  const words = cleaned.split(" ").filter(Boolean);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}...` : cleaned;
}

function compactItems(items: unknown, maxItems = 2, maxWords = 14) {
  const list = Array.isArray(items) ? items : typeof items === "string" ? items.split(/\n|,/) : [];
  return list.map((item) => compactSentence(String(item), maxWords)).filter(Boolean).slice(0, maxItems);
}

function stripJsonFromText(text: string) {
  return text
    .replace(/```(?:json)?[\s\S]*?```/gi, "")
    .replace(/```(?:json)?[\s\S]*$/gi, "")
    .replace(/\n\s*\{\s*["']overview["'][\s\S]*$/i, "")
    .replace(/\n\s*\{\s*["']days["'][\s\S]*$/i, "")
    .trim();
}

/** split a plain-text markdown reply into Day sections (fallback) */
function splitDays(text: string) {
  const lines = stripJsonFromText(text).split(/\r?\n/);
  const days: { title: string; body: string }[] = [];
  let currentTitle = "Overview";
  let buf: string[] = [];

  const push = () => {
    if (buf.join("").trim()) days.push({ title: currentTitle, body: buf.join("\n").trim() });
    buf = [];
  };

  for (const ln of lines) {
    if (/^\s*(?:\*\*|##|#)?\s*day\s*\d+/i.test(ln)) {
      push();
      currentTitle = ln.replace(/^[#\*\s]*/g, "").trim();
    } else {
      buf.push(ln);
    }
  }
  push();
  return days;
}

/** small date diff helper */
function diffNights(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const a = new Date(start);
  const b = new Date(end);
  const ms = b.getTime() - a.getTime();
  if (isNaN(ms) || ms <= 0) return undefined;
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function dateOffsetISO(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(12, 0, 0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function shortPlaceName(place?: string) {
  return (place || "").split("(")[0].replace(/\s+/g, " ").trim();
}

function inferThemeFromPlace(detail: { state?: string; city?: string; location?: string }) {
  const text = `${detail.location || ""} ${detail.state || ""} ${detail.city || ""}`.toLowerCase();
  if (/temple|pilgrimage|ghat|aarti|char dham|kedarnath|badrinath|haridwar|rishikesh|kashi|varanasi|mathura|vrindavan|dwarka|tirupati|shirdi|sabarimala|vaishno|amritsar|golden temple/.test(text)) return "Spiritual";
  if (/fort|palace|heritage|monument|gate|qutub|red fort|old goa|ajanta|ellora|jaipur|udaipur|jaisalmer|rajasthan|delhi/.test(text)) return "Heritage";
  if (/beach|island|coast|backwater|houseboat|goa|lakshadweep|andaman|kovalam|varkala|puducherry|daman|diu/.test(text)) return "Family";
  if (/trek|rafting|ski|wildlife|national park|safari|auli|corbett|spiti|ladakh|valley of flowers|meghalaya|arunachal/.test(text)) return "Adventure";
  if (/ayurveda|yoga|retreat|spa/.test(text)) return "Spiritual";
  return "Family";
}

function buildPrefillNotes(detail: { state?: string; city?: string; location?: string }) {
  const destination = shortPlaceName(detail.location) || detail.city || detail.state || "this destination";
  const region = detail.state || detail.city;
  return [
    `Plan a practical route focused on ${destination}${region && region !== destination ? ` in ${region}` : ""}.`,
    "Keep the pacing comfortable, include local experiences, food suggestions, transit notes, and the best route order.",
  ].join(" ");
}

/** Extract a fenced JSON block (```json ... ```) or plain JSON from text */
function extractJsonBlock(text: string) {
  if (!text) return null;
  const candidates = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)].map((match) => match[1]);
  candidates.push(text);

  for (const candidate of candidates) {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) continue;
    try {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    } catch {
      // try the next fenced block or full response
    }
  }
  return null;
}

export default function PlannerModal({ open: controlledOpen, onClose }: Props) {
  // visible: controlled when prop provided, otherwise internal and triggered by "open-planner"
  const [visible, setVisible] = useState<boolean>(false);

  // itinerary state
  const [state, setState] = useState<ItinState>("idle");
  const [result, setResult] = useState("");
  const [structured, setStructured] = useState<any | null>(null);
  const [err, setErr] = useState("");

  // form fields
  const [arrive, setArrive] = useState("");
  const [depart, setDepart] = useState("");
  const [destinations, setDestinations] = useState<string[]>([]);
  const [destInput, setDestInput] = useState("");
  const [budget, setBudget] = useState("");
  const [startCity, setStartCity] = useState("");
  const [theme, setTheme] = useState("Adventure");
  const [notes, setNotes] = useState("");

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);
  const datesInvalid = arrive && depart && new Date(depart) <= new Date(arrive);
  const nights = diffNights(arrive, depart);

  const canSubmit = useMemo(
    () => destinations.length > 0 && !!arrive && !!depart && (nights ?? 0) > 0 && state !== "loading",
    [destinations, arrive, depart, nights, state]
  );

  const hasPlannerPrefill = destinations.length > 0 && !!arrive && !!depart;
  const days = useMemo(() => (state === "done" && !structured ? splitDays(result) : []), [state, result, structured]);

  useEffect(() => {
    // if parent controls, mirror controlledOpen
    if (typeof controlledOpen === "boolean") setVisible(controlledOpen);
  }, [controlledOpen]);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  useEffect(() => {
    // Listen for global events even when parent controls the open state so location
    // buttons can prefill the planner before the parent opens it.
    function handleOpen() {
      setVisible(true);
      setState("idle");
      setErr("");
      setResult("");
      setStructured(null);
    }
    function handleOpenWith(event: Event) {
      const detail = (event as CustomEvent<{ state?: string; city?: string; location?: string }>).detail;
      const next = [detail?.location, detail?.state, detail?.city].filter(Boolean) as string[];
      if (next.length > 0) {
        setDestinations(Array.from(new Set(next)));
        setArrive(dateOffsetISO(7));
        setDepart(dateOffsetISO(11));
        setStartCity(detail?.city || shortPlaceName(detail?.location) || detail?.state || "");
        setTheme(inferThemeFromPlace(detail || {}));
        setNotes(buildPrefillNotes(detail || {}));
        setBudget("");
        setDestInput("");
      }
      handleOpen();
    }
    window.addEventListener("open-planner", handleOpen);
    window.addEventListener("open-planner-with", handleOpenWith as EventListener);
    return () => {
      window.removeEventListener("open-planner", handleOpen);
      window.removeEventListener("open-planner-with", handleOpenWith as EventListener);
    };
  }, [controlledOpen]);

  function handleClose() {
    if (onClose) onClose();
    setVisible(false);
  }

  function onArriveChange(v: string) {
    setArrive(v);
    if (depart && v && new Date(depart) <= new Date(v)) {
      const d = new Date(v);
      d.setDate(d.getDate() + 1);
      setDepart(d.toISOString().split("T")[0]);
    }
  }

  function addDestination() {
    const raw = destInput.trim();
    if (!raw) return;
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = Array.from(new Set([...destinations, ...parts]));
    setDestinations(next);
    setDestInput("");
  }

  function removeDestination(name: string) {
    setDestinations((d) => d.filter((x) => x.toLowerCase() !== name.toLowerCase()));
  }

  function handleDestKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDestination();
    }
  }

  function buildSystemPrompt(expectedDays: number, expectedNights?: number) {
    const fenceHint = "Wrap the JSON in a fenced block labeled json (```json ... ```).";
    return [
      "You are Travel Assistant for Journey Gate.",
      "Return TWO things in your reply:",
      "1) A very concise, traveler-friendly Markdown itinerary using 'Day 1', 'Day 2', etc.",
      `2) Immediately after the markdown, include a valid JSON object and ${fenceHint}`,
      "",
      `Trip length is exact: ${expectedNights || expectedDays - 1} nights = ${expectedDays} calendar days.`,
      `You must include every day from Day 1 through Day ${expectedDays}.`,
      `The JSON days array must contain exactly ${expectedDays} day objects.`,
      "Do not return only Day 1 unless the requested trip is actually 1 day.",
      "",
      "JSON shape (example):",
      `{
  "overview": "short overview text",
  "total_nights": 5,
  "route": ["Place A","Place B"],
  "days": [
    {
      "day": 1,
      "title": "Day 1 — City to City",
      "drive_time": "2h",
      "nights_at": "Place A",
      "highlights": ["spot 1","spot 2"],
      "food_suggestions": ["cafe x","dish y"]
    }
  ],
  "cost_guidance": {"economy":"₹X","mid":"₹Y","premium":"₹Z"},
  "summary": "one-line summary encouraging contact"
}`,
      "",
      "Rules:",
      "- Keep the markdown compact and scannable.",
      "- Overview must be 20 words or fewer.",
      "- Each day must have one short title and exactly 2 short activity bullets.",
      "- Each activity bullet must be 12 words or fewer.",
      "- Food suggestions should be 1 or 2 short items only.",
      "- Do not write paragraphs inside day sections.",
      "- The JSON must be valid JSON (no trailing commas) and must be wrapped in a fenced ```json block.",
      `- Include exactly ${expectedDays} markdown day sections and exactly ${expectedDays} JSON day objects.`,
      "- End the markdown with a short summary line and then the JSON block.",
    ].join("\n");
  }

  async function generate() {
    if (!canSubmit) return;
    setState("loading");
    setErr("");
    setResult("");
    setStructured(null);

    const when =
      arrive && depart
        ? `Arrive ${new Date(arrive).toLocaleDateString()}, depart ${new Date(depart).toLocaleDateString()} (${nights} nights).`
        : "";

    const expectedDays = Math.max(1, (nights || 1) + 1);
    const list = destinations.join(", ");
    const system = buildSystemPrompt(expectedDays, nights);
    const user = [
      `Plan a combined itinerary for: ${list}.`,
      when ? ` ${when}` : "",
      ` Exact itinerary length: ${expectedDays} days / ${nights || expectedDays - 1} nights. Include Day 1 through Day ${expectedDays}.`,
      startCity ? ` Starting city: ${startCity}.` : "",
      budget ? ` Budget: ${budget}.` : "",
      theme ? ` Theme: ${theme}.` : "",
      notes ? ` Notes: ${notes}.` : "",
      "\nPlease propose the best route order and allocate nights accordingly.",
    ].join("");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          maxOutputTokens: 1800,
          temperature: 0.5,
          timeoutMs: 18000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        setErr(`AI error: ${res.status} ${res.statusText} ${txt}`);
        setState("error");
        return;
      }

      const data = await res.json();
      const reply = data?.reply || data?.message || "";
      setResult(reply);

      // try to parse JSON
      const parsed = extractJsonBlock(reply);
      if (parsed) {
        setStructured(parsed);
      } else {
        setStructured(null);
      }

      setState("done");
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setErr("Request timed out after 60s. Try again with fewer destinations or check network.");
      } else {
        setErr(e?.message || "Failed to generate itinerary.");
      }
      setState("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleReset() {
    setArrive("");
    setDepart("");
    setDestinations([]);
    setDestInput("");
    setBudget("");
    setStartCity("");
    setTheme("Adventure");
    setNotes("");
    setResult("");
    setStructured(null);
    setErr("");
    setState("idle");
  }

  function renderDayCard(day: any, idx: number) {
    const dayNumber = day?.day || idx + 1;
    const title = cleanDisplayText(day?.title || `Day ${dayNumber}`);
    const titleWithoutPrefix = title.replace(/^Day\s+\d+\s*[-—:]\s*/i, "");
    const highlights = compactItems(day?.highlights, 2, 13);
    const food = compactItems(day?.food_suggestions, 2, 6);
    const drive = compactSentence(day?.drive_time, 6);
    const nightsAt = compactSentence(day?.nights_at, 8);

    return (
      <article key={`${dayNumber}-${idx}`} className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-700">Day {dayNumber}</div>
            <h4 className="truncate text-sm font-black text-slate-900">{titleWithoutPrefix || title}</h4>
          </div>
          {drive && <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">{drive}</span>}
        </div>
        <div className="space-y-3 p-3">
          <ul className="grid gap-2">
            {highlights.map((item, itemIdx) => (
              <li key={itemIdx} className="flex gap-2 text-sm leading-5 text-slate-700">
                <Sparkles className="mt-0.5 h-4 w-4 flex-none text-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {nightsAt && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Stay: {nightsAt}</span>}
            {food.length > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Food: {food.join(", ")}</span>}
          </div>
        </div>
      </article>
    );
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="absolute inset-0 grid place-items-center p-3 sm:p-4">
        <div className="flex h-[min(820px,calc(100vh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-white/95 shadow-2xl backdrop-blur">
          {/* Header */}
          <div className="flex flex-none items-center justify-between px-5 py-4 sm:px-6 bg-gradient-to-r from-primary/90 to-primary text-primary-foreground">
            <div>
              <h3 className="text-lg font-bold">Get Your Free Itinerary (Multi-Destination)</h3>
              <p className="text-xs opacity-90">Pick dates and places — we’ll propose the route and nights per stop.</p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleReset} title="Reset form" className="rounded-md px-3 py-1 bg-white/10 text-white text-sm hover:bg-white/20">
                Reset
              </button>
              <button onClick={handleClose} className="h-9 w-9 grid place-items-center rounded-full hover:bg-white/20" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Form + Output */}
          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden px-5 py-5 sm:px-6 md:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1.1fr)]">
            {/* LEFT: Inputs */}
            <div className="min-h-0 overflow-hidden pr-1">
              <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <label className="text-xs font-medium">Arrival</label>
                  <input
                    type="date"
                    min={todayISO}
                    className={`rounded-xl border px-3 py-2 text-sm ${datesInvalid ? "border-red-500" : "border-border"}`}
                    value={arrive}
                    onChange={(e) => onArriveChange(e.target.value)}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium">Departure</label>
                  <input
                    type="date"
                    min={arrive || todayISO}
                    className={`rounded-xl border px-3 py-2 text-sm ${datesInvalid ? "border-red-500" : "border-border"}`}
                    value={depart}
                    onChange={(e) => setDepart(e.target.value)}
                  />
                </div>
              </div>

              {datesInvalid && <p className="text-xs text-red-600 -mt-1">Departure must be after Arrival. I’ve nudged it automatically if needed.</p>}

              {/* Destinations */}
              <div className="grid gap-1">
                <label className="text-xs font-medium">Destinations (add multiple)</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                    placeholder="e.g., Manali, Ladakh"
                    value={destInput}
                    onChange={(e) => setDestInput(e.target.value)}
                    onKeyDown={handleDestKey}
                  />
                  <button type="button" onClick={addDestination} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted">
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>

                {destinations.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {destinations.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
                        <MapPin className="h-3.5 w-3.5" /> {d}
                        <button onClick={() => removeDestination(d)} className="ml-1 opacity-70 hover:opacity-100" aria-label={`Remove ${d}`}>
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder="Starting City (optional)" value={startCity} onChange={(e) => setStartCity(e.target.value)} />

              <div className="grid grid-cols-2 gap-3">
                <input className="rounded-xl border border-border px-3 py-2 text-sm" placeholder="Budget (₹/mid/premium)" value={budget} onChange={(e) => setBudget(e.target.value)} />
                <select className="rounded-xl border border-border px-3 py-2 text-sm bg-background" value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option>Adventure</option><option>Family</option><option>Honeymoon</option><option>Spiritual</option><option>Heritage</option><option>Budget Backpacking</option><option>Luxury</option>
                </select>
              </div>

              <textarea className="rounded-xl border border-border px-3 py-2 text-sm min-h-[84px]" placeholder="Anything specific? (e.g., high passes, ropeway, café crawls, sunrise points)" value={notes} onChange={(e) => setNotes(e.target.value)} />

              <div className="flex gap-2 items-center">
                <button onClick={generate} disabled={!canSubmit} className="mt-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 font-semibold shadow hover:opacity-90 disabled:opacity-50">
                  {state === "loading" ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating itinerary…</> : <><Sparkles className="h-4 w-4" /> Build Itinerary <ChevronRight className="h-4 w-4" /></>}
                </button>
              </div>

              {state === "error" && <div className="text-sm text-red-600"><div>Couldn't generate itinerary: {err}</div><button onClick={generate} className="mt-2 px-3 py-1 rounded-md bg-amber-400 text-black font-semibold">Retry</button></div>}
              </div>
            </div>

            {/* RIGHT: Output */}
            <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex-none border-b border-border bg-white/80 px-4 py-3">
                <div className="text-sm font-black text-slate-900">Itinerary Preview</div>
                <p className="text-xs text-muted-foreground">Compact day-wise plan</p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {state === "idle" && (
                <div className="text-center text-muted-foreground py-10">
                  <Sparkles className="h-6 w-6 mx-auto mb-2" />
                  {hasPlannerPrefill ? (
                    <>
                      Review the prefilled trip details, add budget only if needed, then click <span className="font-semibold">Build Itinerary</span>.
                    </>
                  ) : (
                    <>
                      Add your <b>dates</b> and <b>destinations</b>, then click <span className="font-semibold">Build Itinerary</span>.
                    </>
                  )}
                </div>
              )}
              {state === "loading" && <div className="space-y-3 animate-pulse"><div className="h-5 w-2/5 rounded bg-muted/60" /><div className="h-16 w-full rounded bg-muted/40" /><div className="h-5 w-1/3 rounded bg-muted/60" /><div className="h-16 w-full rounded bg-muted/40" /></div>}

              {state === "done" && (
                <div className="space-y-5">
                  {/* meta tags */}
                  <div className="flex flex-wrap items-center gap-2">
                    {arrive && depart && <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"><Calendar className="h-4 w-4" /> {new Date(arrive).toLocaleDateString()} → {new Date(depart).toLocaleDateString()} {nights ? `• ${nights} nights` : ""}</span>}
                    {destinations.length > 0 && <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"><MapPin className="h-4 w-4" /> {destinations.join(" • ")}</span>}
                    {budget && <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs"><IndianRupee className="h-4 w-4" /> {budget}</span>}
                    {theme && <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">✨ {theme}</span>}
                  </div>

                  {/* If structured JSON parsed, render structured UI */}
                  {structured ? (
                    <div className="space-y-3">
                      {structured.overview && (
                        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-sky-50/70 shadow-sm">
                          <div className="border-b border-sky-100 bg-white/60 px-3 py-2"><h4 className="text-sm font-black text-slate-900">Overview</h4></div>
                          <p className="p-3 text-sm leading-6 text-slate-700">{compactSentence(structured.overview, 22)}</p>
                        </div>
                      )}

                      {Array.isArray(structured.days) && structured.days.map((d: any, idx: number) => renderDayCard(d, idx))}
                      {structured.cost_guidance && (
                        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 shadow-sm">
                          <h4 className="mb-2 text-sm font-black text-slate-900">Cost Guide</h4>
                          <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                            <div className="rounded-xl bg-white px-3 py-2"><b>Economy</b><br />{compactSentence(structured.cost_guidance.economy, 8)}</div>
                            <div className="rounded-xl bg-white px-3 py-2"><b>Mid</b><br />{compactSentence(structured.cost_guidance.mid, 8)}</div>
                            <div className="rounded-xl bg-white px-3 py-2"><b>Premium</b><br />{compactSentence(structured.cost_guidance.premium, 8)}</div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="space-y-4">
                      {days.length > 0 ? (
                        days.map((d, i) => (
                          <div key={i} className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                            <div className="border-b border-emerald-100 bg-emerald-50 px-3 py-2"><h4 className="text-sm font-black text-slate-900">{cleanDisplayText(d.title)}</h4></div>
                            <div className="space-y-2 p-3">
                              {d.body.split("\n").filter(Boolean).slice(0, 3).map((ln, idx) => (
                                <p key={idx} className="text-sm leading-5 text-slate-700">{compactSentence(ln, 16)}</p>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="whitespace-pre-wrap rounded-2xl border border-border bg-white p-3 text-sm leading-6 text-slate-700">{compactSentence(stripJsonFromText(result), 90)}</div>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl bg-primary text-primary-foreground p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h5 className="font-bold">Want us to book & fine-tune this?</h5>
                      <p className="text-xs opacity-90">Talk to a travel expert now — quick recommendations & best rates.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href="tel:+918076874156" className="inline-flex items-center gap-2 rounded-lg bg-white text-foreground px-3 py-2 font-semibold shadow hover:bg-muted"><Phone className="h-4 w-4" /> 8076874156</a>
                      <a href="tel:+918595167227" className="inline-flex items-center gap-2 rounded-lg bg-white text-foreground px-3 py-2 font-semibold shadow hover:bg-muted"><Phone className="h-4 w-4" /> 8595167227</a>
                      <a href="mailto:jgadven@gmail.com?subject=Itinerary%20help" className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-3 py-2 font-semibold hover:bg-white/10"><Mail className="h-4 w-4" /> jgadven@gmail.com</a>
                    </div>
                  </div>
                </div>
              )}

              {state === "error" && <div className="text-sm text-red-600 p-3">{err || "Something went wrong."}</div>}
              </div>
            </div>
          </div>

          <div className="flex-none border-t border-border bg-white/85 px-5 py-3 sm:px-6">
            <button onClick={handleClose} className="w-full sm:w-auto rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

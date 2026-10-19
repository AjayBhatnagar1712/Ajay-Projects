"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

type StructuredItin = {
  summary?: string;
  suggested_days?: string;
  best_season?: string;
  budget_guidance?: { economy?: string; mid?: string; premium?: string };
  itinerary?: { day: string; highlights: string[] }[];
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  structured?: StructuredItin | null;
};

const CONTACT_LINE =
  "For stays, transport, permits, and bookings, contact Journey Gate at 8595167227 / 8076874156 or jgadven@gmail.com.";

const SYSTEM_PROMPT = `
You are Travel Assistant, the official conversational guide for Journey Gate.
Rules:
- Be professional, warm, and concise. Do not say you are an AI.
- Give fast, practical travel guidance with route order, best season, budget, and daily highlights when useful.
- Do not mention or recommend named hotels, resorts, Airbnbs, or stay properties.
- Include the Journey Gate contact line at most once.
- Whenever useful, include a fenced JSON block with this schema:
{
  "summary": "single-line suggestion",
  "suggested_days": "3-4 days",
  "best_season": "Oct-Mar",
  "budget_guidance": {"economy":"INR X-Y","mid":"INR X-Y","premium":"INR X+"},
  "itinerary": [
    {"day":"Day 1","highlights":["one short phrase","second short phrase"]}
  ]
}
`;

function extractJson(candidate: string): StructuredItin | null {
  const fenced = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const payload = fenced ? fenced[1] : candidate;
  const start = payload.indexOf("{");
  const end = payload.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  const jsonStr = payload.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr) as StructuredItin;
  } catch {
    try {
      return JSON.parse(jsonStr.replace(/,\s*}/g, "}").replace(/,\s*\]/g, "]")) as StructuredItin;
    } catch {
      return null;
    }
  }
}

function ensureContact(text: string) {
  const cleaned = text.replace(/\b(hotel|resort|villa|lodge|guesthouse|homestay|bnb|inn)\b/gi, "stay option");
  if (/8595167227|8076874156|jgadven@gmail\.com/.test(cleaned)) return cleaned.trim();
  return `${cleaned.trim()}\n\n${CONTACT_LINE}`;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: "welcome",
      role: "assistant",
      text: "Hi, I am your Journey Gate travel assistant. Ask for itineraries, best time to visit, routes, budgets, or group trip ideas.",
      at: new Date().toISOString(),
      structured: null,
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 200;
  }, [messages, open]);

  function pushMessage(role: Msg["role"], text: string, structured: StructuredItin | null = null) {
    setMessages((s) => [
      ...s,
      {
        id: Math.random().toString(36).slice(2),
        role,
        text,
        at: new Date().toISOString(),
        structured,
      },
    ]);
  }

  async function handleSend(e?: React.FormEvent, directPrompt?: string) {
    e?.preventDefault();
    const trimmed = (directPrompt ?? input).trim();
    if (!trimmed || loading) return;

    pushMessage("user", trimmed);
    setInput("");
    setLoading(true);
    setOpen(true);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: trimmed },
          ],
          maxOutputTokens: 850,
          temperature: 0.45,
          timeoutMs: 15000,
        }),
      });

      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();
      const reply = (data?.reply || data?.answer || "").trim();
      const structured = extractJson(reply);

      if (structured) {
        pushMessage("assistant", structured.summary || "Here is a compact plan.", structured);
      } else {
        const sanitized = ensureContact(reply || "I could not draft that yet. Please try again.");
        pushMessage("assistant", sanitized.length > 1100 ? `${sanitized.slice(0, 1100)}...` : sanitized, null);
      }
    } catch (err) {
      console.error("Chat send error:", err);
      pushMessage(
        "assistant",
        "Sorry, something went wrong. Please try again or contact our travel experts at 8595167227 / 8076874156 or jgadven@gmail.com.",
        null
      );
    } finally {
      setLoading(false);
    }
  }

  function renderStructuredCard(s: StructuredItin) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
        {s.summary && <div className="mb-2 text-sm font-semibold text-emerald-950">{s.summary}</div>}
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-slate-600">
          {s.suggested_days && <span className="rounded-full bg-emerald-50 px-2 py-1">{s.suggested_days}</span>}
          {s.best_season && <span className="rounded-full bg-amber-50 px-2 py-1">Best: {s.best_season}</span>}
        </div>

        {Array.isArray(s.itinerary) && (
          <div className="space-y-2">
            {s.itinerary.slice(0, 4).map((d, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-2">
                <div className="text-xs font-bold text-slate-900">{d.day}</div>
                <div className="text-xs text-slate-700">{d.highlights.slice(0, 3).join(" | ")}</div>
              </div>
            ))}
          </div>
        )}

        {s.budget_guidance && (
          <div className="mt-3 grid gap-1 text-xs text-slate-700">
            <strong>Budget guide</strong>
            <span>Economy: {s.budget_guidance.economy || "-"}</span>
            <span>Mid: {s.budget_guidance.mid || "-"}</span>
            <span>Premium: {s.budget_guidance.premium || "-"}</span>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <a href="tel:+918076874156" className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">
            Call 8076874156
          </a>
          <a href="mailto:jgadven@gmail.com" className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800">
            Email
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-[70] pointer-events-auto md:bottom-6 md:right-6">
      {!open ? (
        <button
          aria-label="Open chat"
          onClick={() => setOpen(true)}
          className="grid h-12 w-12 place-items-center rounded-full bg-cyan-700 text-white shadow-2xl shadow-sky-950/25 transition hover:-translate-y-0.5 hover:bg-cyan-800 md:h-14 md:w-14"
          title="Chat with us"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : (
        <div className="w-[92vw] max-w-[420px] overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/95 shadow-2xl shadow-sky-950/20 backdrop-blur md:w-96">
          <div className="flex items-center justify-between bg-gradient-to-r from-sky-950 to-cyan-700 px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/15 p-2">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">Travel Assistant</div>
                <div className="text-xs text-sky-50">Fast route and itinerary ideas</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Minimize" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex max-h-[58vh] flex-col gap-3 overflow-auto bg-gradient-to-b from-white to-sky-50/80 p-4">
            {messages.map((m) =>
              m.role === "assistant" ? (
                <div key={m.id} className="max-w-[88%] self-start rounded-2xl bg-sky-50 p-3 text-sm text-slate-800">
                  {m.structured ? (
                    <>
                      <div className="mb-2 text-xs text-slate-700">{m.text}</div>
                      {renderStructuredCard(m.structured)}
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  )}
                  <div className="mt-1 text-xs text-slate-400">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              ) : (
                <div key={m.id} className="max-w-[88%] self-end rounded-2xl bg-cyan-800 p-3 text-right text-sm text-white">
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  <div className="mt-1 text-xs text-cyan-100">{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              )
            )}

            {loading && (
              <div className="flex max-w-[88%] items-center gap-2 self-start rounded-2xl bg-white p-3 text-sm text-slate-600 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Drafting a concise plan...
              </div>
            )}
          </div>

          <div className="border-t border-sky-100 bg-white p-4">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for a trip plan..."
                className="min-w-0 flex-1 rounded-full border border-sky-100 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-600/30"
                aria-label="Type your message"
              />
              <button
                type="submit"
                disabled={loading}
                className="grid h-10 w-10 place-items-center rounded-full bg-cyan-700 text-white disabled:opacity-60"
                aria-label="Send"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => handleSend(undefined, "3-day itinerary for Shimla")} className="rounded-full border border-sky-100 px-3 py-1 text-xs hover:bg-sky-50">
                3-day Shimla
              </button>
              <button onClick={() => handleSend(undefined, "Best time to visit Manali")} className="rounded-full border border-sky-100 px-3 py-1 text-xs hover:bg-sky-50">
                Best time: Manali
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

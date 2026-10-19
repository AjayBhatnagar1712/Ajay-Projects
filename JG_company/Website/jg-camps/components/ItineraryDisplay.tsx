"use client";

import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CalendarDays, CheckCircle2, Copy, Mail, Phone, Sparkles } from "lucide-react";

type DaySection = { day: string; content: string };

interface ItineraryDisplayProps {
  itinerary: string | DaySection[];
}

function normalize(itinerary: string | DaySection[]): {
  sections: DaySection[];
  rawMarkdown?: string;
} {
  if (Array.isArray(itinerary)) return { sections: itinerary };

  const text = itinerary?.toString?.() ?? "";
  if (!text.trim()) return { sections: [], rawMarkdown: "" };

  const cleaned = text.replace(/```json[\s\S]*?```/gi, "").trim();
  const parts = cleaned.split(/(^|\n)(#{0,3}\s*\*{0,2}Day\s*\d+[^\n]*\*{0,2})/gi).filter(Boolean);

  const sections: DaySection[] = [];
  for (let i = 0; i < parts.length; i++) {
    const label = parts[i];
    if (/^\s*#{0,3}\s*\*{0,2}Day\s*\d+/i.test(label)) {
      sections.push({
        day: label.replace(/^[#*\s]+|[*\s]+$/g, "").trim(),
        content: (parts[i + 1] || "").trim(),
      });
      i++;
    }
  }

  if (sections.length === 0) return { sections: [], rawMarkdown: cleaned };
  return { sections };
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <p className="text-sm leading-6 text-slate-700">{children}</p>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="mt-2 space-y-1.5">{children}</ul>,
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-2 text-sm leading-6 text-slate-700">
      <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-emerald-600" />
      <span>{children}</span>
    </li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-semibold text-slate-950">{children}</strong>,
};

const ItineraryDisplay: React.FC<ItineraryDisplayProps> = ({ itinerary }) => {
  const { sections, rawMarkdown } = useMemo(() => normalize(itinerary), [itinerary]);
  const [copied, setCopied] = useState(false);
  const plainText = Array.isArray(itinerary)
    ? itinerary.map((s) => `${s.day}\n${s.content}`).join("\n\n")
    : itinerary;

  async function copyPlan() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="itinerary-shell mt-6 overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10">
      <div className="flex flex-col gap-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-950 via-emerald-800 to-teal-700 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-emerald-50">
            <Sparkles className="h-3.5 w-3.5" />
            AI itinerary draft
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Suggested Itinerary</h2>
          <p className="mt-1 text-sm text-emerald-50/90">Fast draft, ready for expert fine-tuning and bookings.</p>
        </div>
        <button
          onClick={copyPlan}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-50"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy plan"}
        </button>
      </div>

      <div className="grid gap-4 bg-gradient-to-b from-white to-emerald-50/60 p-4 sm:p-6">
        {sections.length > 0 ? (
          sections.map((s, idx) => (
            <article key={`${s.day}-${idx}`} className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-700">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <h3 className="text-lg font-bold text-emerald-950">{s.day}</h3>
              </div>
              <div className="space-y-2">
                <ReactMarkdown components={markdownComponents}>{s.content}</ReactMarkdown>
              </div>
            </article>
          ))
        ) : (
          <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <ReactMarkdown components={markdownComponents}>{rawMarkdown || "_No details available._"}</ReactMarkdown>
          </article>
        )}

        <div className="rounded-2xl bg-emerald-950 p-4 text-white">
          <h3 className="font-bold">Ready to make this real?</h3>
          <p className="mt-1 text-sm text-emerald-50/90">
            Our team can refine routes, stays, transport, permits, meals, and on-ground support.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="tel:+918076874156" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-950">
              <Phone className="h-4 w-4" />
              8076874156
            </a>
            <a href="tel:+918595167227" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-950">
              <Phone className="h-4 w-4" />
              8595167227
            </a>
            <a href="mailto:jgadven@gmail.com" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white">
              <Mail className="h-4 w-4" />
              Email
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryDisplay;

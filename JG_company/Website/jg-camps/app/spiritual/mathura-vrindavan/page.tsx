"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function MathuraVrindavanPage() {
  const title = "Mathura & Vrindavan";
  const region = "Uttar Pradesh";
  const image = "/images/spiritual/mathura.jpg";
  const blurb = "Birthplace of Lord Krishna with colourful festivals and temple culture.";
  const bestSeason = "Oct–Mar";

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="relative h-[48vh] md:h-[56vh] overflow-hidden">
        <Image src={image} alt={title} fill className="object-cover" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative z-10 h-full flex items-end p-6 text-white">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold">{title}</h1>
            <p className="text-sm opacity-90">{region}</p>
            <p className="text-xs text-amber-200 mt-1">Best: {bestSeason}</p>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto p-6">
        <p className="text-gray-700 mb-6">{blurb}</p>
        <div className="flex gap-3">
          <Link href="/spiritual" className="inline-flex items-center px-4 py-2 rounded-full border border-emerald-800 text-emerald-800 font-medium hover:bg-emerald-50">
            ← Back to Spiritual Index
          </Link>
          <button onClick={() => window.dispatchEvent(new Event("open-planner"))} className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-800 text-white font-semibold hover:brightness-95">
            Plan & Book
          </button>
        </div>
      </section>
    </main>
  );
}

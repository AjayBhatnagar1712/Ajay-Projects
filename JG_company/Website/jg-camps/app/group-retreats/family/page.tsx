// app/group-retreats/family/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function FamilyPage() {
  return (
    <main className="bg-white text-slate-800">
      <section className="relative w-full h-[48vh] md:h-[56vh] overflow-hidden rounded-b-3xl shadow-lg">
        <Image src="/images/group-retreats/family.jpg" alt="Family Tours" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="text-white">
            <motion.h1 initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl md:text-4xl font-extrabold">
              Family Tours
            </motion.h1>
            <p className="mt-3 text-sm max-w-xl">Multi-generational trips, easy logistics and family-friendly activities.</p>
            <div className="mt-6">
              <Link href="/group-retreats/plan?format=family" className="inline-flex px-4 py-2 bg-amber-400 rounded-2xl font-semibold">
                Plan Family Trip
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="py-10 px-6 container mx-auto">
        <h2 className="text-2xl font-bold mb-3">Family-friendly features</h2>
        <ul className="list-disc pl-5 text-gray-700 space-y-2">
          <li>Kid-friendly programs & menus</li>
          <li>Accessible accommodation options</li>
          <li>Flexible activity levels</li>
        </ul>
      </section>
    </main>
  );
}

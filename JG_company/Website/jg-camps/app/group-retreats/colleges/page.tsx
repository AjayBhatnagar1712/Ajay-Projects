// app/group-retreats/colleges/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CollegesPage() {
  return (
    <main className="bg-white text-slate-800">
      <section className="relative w-full h-[48vh] md:h-[56vh] overflow-hidden rounded-b-3xl shadow-lg">
        <Image src="/images/group-retreats/colleges.jpg" alt="Colleges" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="text-white">
            <motion.h1 initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl md:text-4xl font-extrabold">
              Colleges & Student Programs
            </motion.h1>
            <p className="mt-3 text-sm max-w-xl">Leadership, adventure and study-trips for college groups with flexible budgets.</p>
            <div className="mt-6">
              <Link href="/group-retreats/plan?format=colleges" className="inline-flex px-4 py-2 bg-amber-400 rounded-2xl font-semibold">
                Plan College Program
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="py-10 px-6 container mx-auto">
        <h2 className="text-2xl font-bold mb-3">Why choose us</h2>
        <ul className="list-disc pl-5 text-gray-700 space-y-2">
          <li>Custom leadership modules</li>
          <li>Affordable housing & transport</li>
          <li>Risk-assessed adventure modules</li>
        </ul>
      </section>
    </main>
  );
}

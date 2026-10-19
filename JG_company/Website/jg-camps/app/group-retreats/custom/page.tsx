// app/group-retreats/custom/page.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CustomGroupPage() {
  return (
    <main className="bg-white text-slate-800">
      <section className="relative w-full h-[48vh] md:h-[56vh] overflow-hidden rounded-b-3xl shadow-lg">
        <Image src="/images/group-retreats/custom.jpg" alt="Create Your Own Group" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <div className="relative z-10 container mx-auto px-6 h-full flex items-center">
          <div className="text-white">
            <motion.h1 initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-3xl md:text-4xl font-extrabold">
              Create Your Own Group
            </motion.h1>
            <p className="mt-3 text-sm max-w-xl">Have a vision? We'll build a fully-branded itinerary and handle logistics end-to-end.</p>
            <div className="mt-6">
              <Link href="/group-retreats/plan?format=custom" className="inline-flex px-4 py-2 bg-amber-400 rounded-2xl font-semibold">
                Start Custom Brief
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="py-10 px-6 container mx-auto">
        <h2 className="text-2xl font-bold mb-3">Custom build process</h2>
        <ul className="list-disc pl-5 text-gray-700 space-y-2">
          <li>Briefing and scope</li>
          <li>Branding, itinerary & supplier selection</li>
          <li>Delivery and post-event reporting</li>
        </ul>
      </section>
    </main>
  );
}

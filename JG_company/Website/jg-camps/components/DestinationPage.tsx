"use client";
import Image from "next/image";
import { motion } from "framer-motion";

export type DestinationCard = {
  name: string;
  image: string;
  bestSeason: string;
  famousPlaces: string[];
  highlights: string;
};

interface DestinationPageProps {
  title: string;
  subtitle: string;
  heroImage: string;
  destinations: DestinationCard[];
}

export default function DestinationPage({
  title,
  subtitle,
  heroImage,
  destinations,
}: DestinationPageProps) {
  return (
    <div className="bg-gradient-to-b from-green-50 to-green-100 min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[380px] w-full">
        <Image
          src={heroImage}
          alt={title}
          fill
          priority
          className="object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white px-6">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-6xl font-extrabold drop-shadow-lg"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-4 text-lg md:text-xl max-w-3xl"
          >
            {subtitle}
          </motion.p>
        </div>
      </section>

      {/* Cards Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-emerald-800 mb-10">
          Popular Destinations
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {destinations.map((state, idx) => (
            <motion.div
              key={state.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: idx * 0.08 }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition"
            >
              <div className="relative h-48 w-full">
                <Image
                  src={state.image}
                  alt={state.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="text-2xl font-semibold text-emerald-800">{state.name}</h3>

                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-3 py-1 rounded-full text-sm bg-emerald-100 text-emerald-700">
                    Best Season: {state.bestSeason}
                  </span>
                </div>

                <div className="mt-3 text-gray-700 italic text-sm">{state.highlights}</div>

                <div className="mt-4">
                  <p className="font-semibold text-gray-800 mb-1">Famous Tourist Places:</p>
                  <ul className="list-disc list-inside text-gray-700 space-y-1">
                    {state.famousPlaces.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>

                <p className="text-sm text-gray-500 italic mt-4">
                  We also organize tours to lesser-known destinations in this state.
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

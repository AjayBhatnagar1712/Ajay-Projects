"use client";

import Image from "next/image";
import Link from "next/link";
import Head from "next/head";
import { motion } from "framer-motion";

export default function AboutPage() {
  const openContact = () => window.dispatchEvent(new Event("open-contact-expert"));

  return (
    <>
      <Head>
        <title>About Us - Journey Gate</title>
        <meta
          name="description"
          content="About Journey Gate — our story, values, and founder."
        />
      </Head>

      <main className="min-h-screen bg-white text-gray-800">
        {/* HERO */}
        <section className="relative w-full h-[48vh] overflow-hidden bg-gradient-to-r from-green-700 to-green-900 text-white">
          <video
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            src="/videos/drone_footage.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="relative z-10 flex flex-col items-center justify-center text-center h-full px-4">
            <motion.h1
              className="text-5xl font-extrabold mb-4"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              Our Story & Values
            </motion.h1>
            <p className="max-w-3xl text-lg text-emerald-50">
              Built on a love for travel and a commitment to excellent service,
              we craft experiences that inspire, connect, and support local communities.
            </p>
          </div>
        </section>

        {/* COMPANY STORY */}
        <section className="py-16 px-6 bg-white">
          <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4 text-emerald-800">Why We Exist</h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Founded in the year 2000, we began as a small team of local travel enthusiasts.
                Over time, we expanded into a full-service travel company, curating journeys
                that blend adventure, spirituality, and comfort.
              </p>
              <p className="text-gray-700 mb-6 leading-relaxed">
                Our philosophy revolves around safety, authenticity, sustainability, and
                thoughtful planning — ensuring every trip is seamless and memorable.
              </p>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-emerald-50 p-4 rounded-lg shadow text-center">
                  <p className="text-2xl font-bold text-emerald-700">10000000+</p>
                  <p className="text-sm text-gray-600">Trips Crafted</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg shadow text-center">
                  <p className="text-2xl font-bold text-emerald-700">95%</p>
                  <p className="text-sm text-gray-600">Satisfied Travelers</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg shadow text-center">
                  <p className="text-2xl font-bold text-emerald-700">20000+</p>
                  <p className="text-sm text-gray-600">Destinations Covered</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg shadow text-center">
                  <p className="text-2xl font-bold text-emerald-700">24/7</p>
                  <p className="text-sm text-gray-600">Expert Support</p>
                </div>
              </div>
            </div>

            {/* PHOTO GRID */}
            <div className="grid grid-cols-2 gap-4">
              {["photo1", "photo2", "photo3", "photo4"].map((img) => (
                <div key={img} className="rounded-lg overflow-hidden shadow-lg">
                  <Image
                    src={`/images/about/${img}.jpg`}
                    alt="About image"
                    width={600}
                    height={400}
                    className="object-cover w-full h-full"
                    priority={img === "photo1"} // optional: prioritize first
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FOUNDER (GLASSY PREMIUM LAYOUT) */}
        <section className="py-20 px-6 bg-gray-50">
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Portrait column */}
              <div className="flex justify-center md:justify-start">
                <div
                  className="relative w-72 md:w-96 rounded-3xl overflow-hidden shadow-2xl"
                  aria-hidden
                >
                  {/* portrait sits inside a subtle glass frame */}
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/6 to-white/3 pointer-events-none" />
                  <Image
                    src="/images/team/anant-portrait.jpg"
                    alt="Founder portrait"
                    width={900}
                    height={1200}
                    className="object-cover w-full h-full"
                    priority
                  />
                </div>
              </div>

              {/* Text column (glassy card) */}
              <div>
                <div className="relative">
                  <div className="rounded-2xl bg-white/30 backdrop-blur-md border border-white/20 shadow-xl p-8 md:p-10">
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                      Who We Serve
                    </h2>

                    <p className="text-gray-700 mb-4 leading-relaxed">
                      We serve explorers, families, and organizations who believe in meaningful travel.
                      Our guests value well-planned, authentic journeys that bring them closer to
                      culture, nature, and connection.
                    </p>

                    <h3 className="text-xl font-semibold mt-4 mb-3">About the Founder</h3>
                    <p className="text-gray-700 leading-relaxed">
                      The company was founded in 2000 by <span className="font-semibold">Anant Arya</span>,
                      an ex-PMO advisor and travel visionary. He has trained over 200+ schools, colleges,
                      and corporate teams, and has led specialised training programs for army personnel
                      and government officials. His leadership, discipline, and dedication to real-world
                      learning shaped the ethos of the company.
                    </p>

                    <ul className="mt-6 space-y-3 text-gray-700">
                      <li className="flex items-start gap-3">
                        <span className="inline-grid place-items-center bg-emerald-100 text-emerald-700 rounded-full w-7 h-7 font-bold">✓</span>
                        <span>Personalized itineraries crafted for every traveler type.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="inline-grid place-items-center bg-emerald-100 text-emerald-700 rounded-full w-7 h-7 font-bold">✓</span>
                        <span>Focus on sustainable, community-driven tourism.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="inline-grid place-items-center bg-emerald-100 text-emerald-700 rounded-full w-7 h-7 font-bold">✓</span>
                        <span>End-to-end planning with safety-first logistics.</span>
                      </li>
                    </ul>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <button
                        onClick={openContact}
                        className="inline-flex items-center px-6 py-3 rounded-2xl bg-emerald-700 text-white font-semibold hover:brightness-95 transition"
                      >
                        Contact Travel Expert
                      </button>

                      <Link
                        href="/"
                        className="inline-flex items-center px-6 py-3 rounded-2xl border border-white/30 text-gray-700 hover:bg-white/5 transition"
                      >
                        Back to Home
                      </Link>
                    </div>
                  </div>

                  {/* Decorative accent circle (glossy) */}
                  <div className="hidden md:block absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-50 opacity-40 blur-[18px]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* VALUES + CTA */}
        <section className="py-16 px-6 bg-white border-t border-gray-100">
          <div className="mx-auto max-w-6xl text-center">
            <h3 className="text-3xl font-bold mb-4 text-emerald-800">Our Values</h3>
            <p className="text-gray-600 mb-8 max-w-3xl mx-auto">
              We believe travel should educate, rejuvenate, and inspire. Every journey
              is an opportunity to connect with people, culture, and the planet — responsibly.
            </p>

            <div className="flex items-center justify-center gap-4">
              {/* Updated: navigate to home + categories anchor */}
              <Link
                href="/#north-destinations"
                className="px-6 py-3 rounded-2xl border border-gray-300 hover:bg-gray-50 transition"
              >
                Explore Destinations
              </Link>
              <button
                onClick={openContact}
                className="px-6 py-3 rounded-2xl bg-emerald-700 text-white font-semibold hover:brightness-95 transition"
              >
                Contact Travel Expert
              </button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

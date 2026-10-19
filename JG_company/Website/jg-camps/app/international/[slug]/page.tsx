import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Globe2, Sparkles } from "lucide-react";
import { getInternationalTrip, INTERNATIONAL_TRIPS } from "@/data/internationalTrips";

export function generateStaticParams() {
  return INTERNATIONAL_TRIPS.map((trip) => ({ slug: trip.slug }));
}

export default async function InternationalTripPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = getInternationalTrip(slug);
  if (!trip) notFound();

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <section className="relative min-h-[68vh] overflow-hidden">
        <Image src={trip.image} alt={trip.title} fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-slate-950/10" />
        <div className="relative z-10 mx-auto flex min-h-[68vh] max-w-7xl flex-col justify-end px-6 pb-12 pt-28 text-white">
          <Link href="/international" className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
            International trips
          </Link>
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-950">
              <Globe2 className="h-3.5 w-3.5" />
              {trip.category}
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-7xl">{trip.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-100">{trip.description}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <CalendarDays className="mb-4 h-6 w-6 text-emerald-700" />
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Ideal Duration</div>
              <div className="mt-2 text-2xl font-black">{trip.duration}</div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <Sparkles className="mb-4 h-6 w-6 text-amber-600" />
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Best Season</div>
              <div className="mt-2 text-2xl font-black">{trip.season}</div>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-950/5">
            <h2 className="text-2xl font-black text-emerald-950">Trip Highlights</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {trip.highlights.map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl bg-emerald-50 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-emerald-700" />
                  <span className="font-medium text-slate-800">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
            <h2 className="text-2xl font-black">How We Pace It</h2>
            <div className="mt-5 grid gap-3">
              {trip.pace.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-100">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-xl shadow-amber-950/10">
          <h2 className="text-2xl font-black text-slate-950">Plan This Trip</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            Share traveler count, dates, comfort level, and must-do experiences. Journey Gate will fine-tune the route and booking plan.
          </p>
          <div className="mt-6 grid gap-3">
            <a href="tel:+918076874156" className="rounded-full bg-emerald-800 px-5 py-3 text-center font-bold text-white">
              Call 8076874156
            </a>
            <a href="mailto:jgadven@gmail.com?subject=International%20trip%20planning" className="rounded-full border border-emerald-800 px-5 py-3 text-center font-bold text-emerald-900">
              Email trip details
            </a>
          </div>
        </aside>
      </section>
    </main>
  );
}

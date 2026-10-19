import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import ChatWidget from "@/components/ChatWidget";
import FooterLinks from "@/components/FooterLinks";
import GlobalCTAs from "@/components/GlobalCTAs";
import HeaderNav from "@/components/HeaderNav";
import RouteTheme from "@/components/RouteTheme";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Journey Gate",
  description: "Expert-planned Himalayan journeys, camps, retreats, and custom itineraries.",
  icons: {
    icon: "/images/brand/journey-gate-icon.png",
    apple: "/images/brand/journey-gate-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-white text-slate-900 antialiased`}>
        <RouteTheme />
        <header className="sticky top-0 z-50 border-b border-white/15 bg-sky-950/80 text-white shadow-xl shadow-sky-950/15 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3 font-black tracking-tight">
              <span className="relative h-12 w-14 flex-none overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-sky-950/20">
                <Image src="/images/brand/journey-gate-mark.png" alt="Journey Gate logo" fill className="object-contain p-1" sizes="56px" priority />
              </span>
              <span className="truncate text-base md:text-lg">Journey Gate</span>
            </Link>

            <HeaderNav />
          </div>
        </header>

        <main className="min-h-screen">{children}</main>

        <footer className="border-t border-white/10 bg-[#031526] text-white">
          <div className="mx-auto grid max-w-7xl gap-7 px-6 py-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-3 font-black text-lg">
                <span className="relative h-12 w-14 overflow-hidden rounded-xl bg-white p-1">
                  <Image src="/images/brand/journey-gate-mark.png" alt="Journey Gate logo" fill className="object-contain p-1" sizes="56px" />
                </span>
                Journey Gate
              </div>
              <p className="mt-4 max-w-md text-sm leading-6 text-sky-50/80">
                Cinematic travel planning for mountain escapes, sacred city circuits, group retreats,
                handpicked stays, and quick expert-refined itinerary drafts.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-sky-50">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Verified partners</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Custom routes</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">On-ground support</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold">Why Travel With Us</h4>
              <ul className="mt-3 grid gap-2 text-sm text-sky-50/80">
                <li>Custom routes for families and groups</li>
                <li>Expert-refined itinerary drafts</li>
                <li>Support for stays, transport and permits</li>
              </ul>
            </div>

            <FooterLinks />
          </div>

          <div className="border-t border-white/10 py-3 text-center text-xs text-sky-50/60">
            Copyright {new Date().getFullYear()} Journey Gate. All rights reserved.
          </div>
        </footer>

        <GlobalCTAs />
        <ChatWidget />
      </body>
    </html>
  );
}

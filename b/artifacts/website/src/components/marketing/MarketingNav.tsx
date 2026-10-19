import React from "react";
import { Menu, X } from "lucide-react";
import { Link } from "wouter";
import logoDark from "@/assets/marketing/trustkeyper Logo.svg";
import {
  MarketingContactUsCta,
  MarketingSignupLoginCta,
} from "@/components/marketing/MarketingNavCtas";
import { cn } from "@/lib/utils";

export interface MarketingNavProps {
  className?: string;
}

export function MarketingNav({ className }: MarketingNavProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 px-4 pt-3 sm:px-6 sm:pt-4", className)}>
      <div className="mx-auto max-w-[1200px] rounded-[29px] bg-marketing-bg/70 shadow-sm ring-1 ring-black/[0.04] backdrop-blur-md">
        <div className="flex h-[72px] items-center justify-between px-6 sm:px-8">
          <Link href="/" className="shrink-0" onClick={closeMenu}>
            <img
              src={logoDark}
              alt="TrustKeyper"
              className="h-9 w-auto sm:h-10"
              draggable={false}
            />
          </Link>

          <nav className="hidden items-center gap-[18px] md:flex" aria-label="Primary">
            <MarketingContactUsCta />
            <MarketingSignupLoginCta />
          </nav>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-marketing-navy transition-colors hover:bg-black/[0.04] md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={22} strokeWidth={2} aria-hidden /> : <Menu size={22} strokeWidth={2} aria-hidden />}
          </button>
        </div>

        {menuOpen ? (
          <nav
            id={menuId}
            className="flex flex-col gap-3 border-t border-black/[0.06] px-6 pb-4 pt-3 md:hidden"
            aria-label="Mobile primary"
          >
            <MarketingContactUsCta className="w-full" onClick={closeMenu} />
            <MarketingSignupLoginCta className="w-full" onClick={closeMenu} />
          </nav>
        ) : null}
      </div>
    </header>
  );
}

import React from "react";
import { Eye, Headset, Home, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManagedCard {
  icon: LucideIcon;
  title: string;
  description: string;
  variant: "surface" | "muted";
  iconSurface: "surface" | "muted";
  staggerClassName: string;
}

const MANAGED_CARDS: ManagedCard[] = [
  {
    icon: Headset,
    title: "Less Follow-Up",
    description:
      "We coordinate with tenants, vendors, and service teams, so you do not have to manage every interaction.",
    variant: "surface",
    iconSurface: "muted",
    staggerClassName: "lg:pt-[186px]",
  },
  {
    icon: Home,
    title: "Better Property Upkeep",
    description: "Routine servicing and timely maintenance help reduce avoidable issues.",
    variant: "muted",
    iconSurface: "surface",
    staggerClassName: "lg:pt-[66px]",
  },
  {
    icon: Eye,
    title: "More Visibility",
    description:
      "Receive clear updates on rent coordination, repairs, servicing, and property condition.",
    variant: "surface",
    iconSurface: "muted",
    staggerClassName: "lg:pt-0",
  },
];

function ManagedCardItem({
  icon: Icon,
  title,
  description,
  variant,
  iconSurface,
}: Omit<ManagedCard, "staggerClassName">) {
  return (
    <article
      className={cn(
        "flex flex-row items-start gap-5 rounded-3xl p-5 sm:flex-col sm:gap-0 sm:p-8",
        variant === "surface" &&
          "bg-white shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)]",
        variant === "muted" && "bg-marketing-neutral-200",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          iconSurface === "muted" && "bg-marketing-neutral-200",
          iconSurface === "surface" && "bg-white",
        )}
      >
        <Icon
          size={20}
          strokeWidth={2}
          className={variant === "muted" ? "text-marketing-neutral-1100" : "text-marketing-navy-dark"}
          aria-hidden
        />
      </span>
      <div className="min-w-0 flex-1 sm:mt-6">
        <h3
          className={cn(
            "text-xl font-semibold leading-[26px]",
            variant === "muted" ? "text-marketing-neutral-1100" : "text-marketing-navy-dark",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mt-3 font-roboto text-sm leading-5 sm:mt-4",
            variant === "muted" ? "text-marketing-neutral-1100" : "text-marketing-navy-dark",
          )}
        >
          {description}
        </p>
      </div>
    </article>
  );
}

export function HomeownerPropertyManagedSection() {
  return (
    <section className="bg-marketing-neutral-100 py-16 lg:py-20" aria-labelledby="homeowner-managed-heading">
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-16 xl:gap-[226px]">
          <div className="max-w-[398px] shrink-0">
            <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
              Why TrustKeyper
            </p>
            <h2
              id="homeowner-managed-heading"
              className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-navy-dark"
            >
              Your property.
              <br />
              Properly managed.
            </h2>
          </div>
          <p className="max-w-[544px] font-roboto text-base leading-6 text-marketing-navy-dark">
            TrustKeyper takes care of the operational side of property ownership so you can stay
            informed without being overwhelmed.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-[60px] lg:grid-cols-3 lg:items-start lg:gap-5">
          {MANAGED_CARDS.map((card) => (
            <li key={card.title} className={card.staggerClassName}>
              <ManagedCardItem {...card} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

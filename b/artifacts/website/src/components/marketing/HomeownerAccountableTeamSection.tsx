import React from "react";
import responsibilityCheck from "@/assets/marketing/homeowners/accountable-team/responsibility-check.svg";
import teamPhoto from "@/assets/marketing/homeowners/accountable-team/team-photo.jpg";

const TEAM_RESPONSIBILITIES = [
  "Coordinates tenant requests",
  "Tracks maintenance activity",
  "Shares property updates",
  "Escalates important issues",
  "Manages approved vendor work",
];

export function HomeownerAccountableTeamSection() {
  return (
    <section
      className="bg-marketing-neutral-100 py-16 lg:py-[140px]"
      aria-labelledby="homeowner-accountable-team-heading"
    >
      <div className="mx-auto max-w-[1168px] px-6 sm:px-8 lg:px-12">
        <div className="max-w-[482px]">
          <p className="font-roboto text-xs font-medium uppercase tracking-[1.2px] text-marketing-neutral-1100">
            Dedicated Support
          </p>
          <h2
            id="homeowner-accountable-team-heading"
            className="mt-5 text-[40px] font-medium leading-[46px] text-marketing-navy-dark"
          >
            One accountable team
            <br />
            for your property.
          </h2>
        </div>

        <div className="relative mt-12 lg:mt-[60px]">
          <div className="relative h-[164px] overflow-hidden rounded-3xl rounded-tr-[120px] bg-marketing-cloud-050 sm:aspect-[1168/581] sm:h-auto sm:rounded-tr-[200px] lg:rounded-tr-[400px]">
            <img
              src={teamPhoto}
              alt="TrustKeyper property manager conducting a property inspection visit"
              className="absolute inset-0 h-full w-[112.5%] max-w-none -translate-x-[6.25%] object-cover"
              draggable={false}
            />
          </div>

          <aside className="relative z-10 mx-auto mt-0 max-w-[539px] rounded-3xl bg-white p-6 shadow-[0_1px_1px_rgba(8,50,42,0.04),0_16px_20px_rgba(8,50,42,0.06)] sm:-mt-10 sm:p-6 lg:absolute lg:bottom-6 lg:left-5 lg:mx-0 lg:mt-0">
            <p className="font-roboto text-base font-medium leading-6 text-marketing-navy-dark">
              <span className="text-marketing-green">Your TrustKeyper team </span>
              understands your property and coordinates the people, services, and updates required
              to keep it running smoothly.
            </p>

            <ul className="mt-6 space-y-4">
              {TEAM_RESPONSIBILITIES.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <img src={responsibilityCheck} alt="" className="h-5 w-5 shrink-0" aria-hidden />
                  <span className="font-roboto text-sm font-medium leading-5 text-marketing-navy-dark">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

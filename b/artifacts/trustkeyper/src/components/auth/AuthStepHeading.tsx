import React from "react";

interface AuthStepHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

/** Section title for signup/login steps — centered on mobile per auth UI reference. */
export function AuthStepHeading({ title, subtitle, className = "" }: AuthStepHeadingProps) {
  return (
    <div
      className={`auth-step-heading mb-6 sm:mb-8 border-b border-gray-200 pb-4 shrink-0 text-center lg:text-left ${className}`}
    >
      <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-gray-500">{subtitle}</p> : null}
    </div>
  );
}

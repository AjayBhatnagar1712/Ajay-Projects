/**
 * Navigation transition audit — documents every replaceRoot / critical
 * replace call site against the root-stack model in replaceRoot.ts.
 *
 * This is a living checklist (executable as a trivial test so CI keeps it).
 */
import { describe, expect, it } from "vitest";

type Transition = {
  name: string;
  call: "replaceRoot" | "replace" | "push" | "goBackOrFallback";
  from: string;
  to: string;
  /** Expected stack after the call (top → … → root). */
  stackAfter: string;
  notes: string;
};

const TRANSITIONS: Transition[] = [
  {
    name: "Splash → Phone (onboarding complete, signed out)",
    call: "replaceRoot",
    from: "[splash]",
    to: "phone",
    stackAfter: "[phone]",
    notes: "onboardingCompleteLocal; canDismiss false → replace only",
  },
  {
    name: "Splash → Intro (onboarding incomplete, signed out)",
    call: "replaceRoot",
    from: "[splash]",
    to: "intro",
    stackAfter: "[intro]",
    notes: "same incompleteness rule as Phone Back; ignores legacy introSeen",
  },
  {
    name: "Splash → onboarding step N (session + incomplete)",
    call: "replaceRoot",
    from: "[splash]",
    to: "step-N",
    stackAfter: "[step-N]",
    notes: "canDismiss false on cold resume via splash",
  },
  {
    name: "Splash → tabs (onboarding complete)",
    call: "replaceRoot",
    from: "[splash]",
    to: "tabs/home",
    stackAfter: "[tabs]",
    notes: "canDismiss false on cold launch",
  },
  {
    name: "Clear local data / Sign out (from Profile over tabs)",
    call: "replaceRoot",
    from: "[tabs, profile]",
    to: "splash",
    stackAfter: "[splash]",
    notes: "canDismiss true → dismissAll then replace(splash)",
  },
  {
    name: "OTP success → onboarding or tabs",
    call: "replaceRoot",
    from: "[phone, otp] (no tabs underneath after clean splash entry)",
    to: "step-N | tabs",
    stackAfter: "[step-N] | [tabs]",
    notes: "dismissAll if phone+otp, then replace destination",
  },
  {
    name: "Onboarding Step 1 Back",
    call: "replaceRoot",
    from: "[step-1]",
    to: "phone (after signOut)",
    stackAfter: "[phone]",
    notes: "signs out; canDismiss false → replace phone",
  },
  {
    name: "Onboarding Step 4 Finish",
    call: "replaceRoot",
    from: "[step-1, step-2, step-3, step-4]",
    to: "tabs/home",
    stackAfter: "[tabs]",
    notes: "canDismiss true → pop onboarding stack then replace tabs",
  },
  {
    name: "Intro → Phone",
    call: "push",
    from: "[intro]",
    to: "phone",
    stackAfter: "[intro, phone]",
    notes: "push so Phone Back can return to carousel while onboarding incomplete",
  },
  {
    name: "Phone → OTP",
    call: "push",
    from: "[phone]",
    to: "otp",
    stackAfter: "[phone, otp]",
    notes: "push so OTP Back / Change can goBack to phone",
  },
  {
    name: "OTP Back → Phone",
    call: "goBackOrFallback",
    from: "[phone, otp]",
    to: "phone",
    stackAfter: "[phone] (or replace phone if no history)",
    notes: "otp.tsx goChangePhone — unchanged",
  },
  {
    name: "Phone Back → Intro (onboarding incomplete)",
    call: "goBackOrFallback",
    from: "[intro, phone] or [phone]",
    to: "intro",
    stackAfter: "[intro]",
    notes: "ignores introSeen; uses onboardingCompleteLocal === false",
  },
  {
    name: "Phone Back when onboarding complete",
    call: "replace",
    from: "[phone]",
    to: "splash (then phone via gate)",
    stackAfter: "[splash] → [phone]",
    notes: "completed users never re-enter carousel via Back",
  },
  {
    name: "Onboarding steps 2–4 Back (with history)",
    call: "goBackOrFallback",
    from: "[step-1…N]",
    to: "previous step",
    stackAfter: "pop one",
    notes: "router.back when canGoBack; else replace previous step href",
  },
  {
    name: "Tabs/Profile gate (incomplete sneaks in)",
    call: "replaceRoot",
    from: "[tabs] illegally",
    to: "step-N",
    stackAfter: "[step-N]",
    notes: "useRequireOnboardingComplete safety net",
  },
  {
    name: "Create-agreement iOS edge-swipe",
    call: "push",
    from: "[tabs, create-agreement]",
    to: "must not pop",
    stackAfter: "[tabs, create-agreement]",
    notes:
      "Root (create-agreement) screen gestureEnabled false — nested false does not stop parent interactive pop to Home",
  },
];

describe("navigation transition audit", () => {
  it("covers every replaceRoot-critical launch and leave path", () => {
    const names = TRANSITIONS.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "Splash → Phone (onboarding complete, signed out)",
        "Splash → Intro (onboarding incomplete, signed out)",
        "Clear local data / Sign out (from Profile over tabs)",
        "OTP success → onboarding or tabs",
        "Onboarding Step 1 Back",
        "Onboarding Step 4 Finish",
        "Intro → Phone",
        "OTP Back → Phone",
        "Phone Back → Intro (onboarding incomplete)",
        "Tabs/Profile gate (incomplete sneaks in)",
        "Create-agreement iOS edge-swipe",
      ]),
    );
    expect(TRANSITIONS.every((t) => t.stackAfter.length > 0)).toBe(true);
  });
});

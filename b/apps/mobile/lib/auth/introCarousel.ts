/** Auto-advance interval for the intro carousel (ms). */
export const INTRO_AUTO_ADVANCE_MS = 4500;

/** Illustration panel height — more presence than the prior 62% pass. */
export const INTRO_ILLUSTRATION_HEIGHT = "70%";

/**
 * Intro slide visual: optional photography (`image` from `require(...)`) with
 * Material Community `icon` fallback when `image` is absent.
 */
export type IntroSlideVisual = {
  icon: string;
  /** `require("../../assets/onboarding/slide-N.png")` — omit to keep icon tile. */
  image?: number;
};

/** Prefer photography when a local asset module id is present. */
export function introUsesImage(slide: IntroSlideVisual): boolean {
  return slide.image != null;
}

/** Next page index, wrapping after the last slide. */
export function nextIntroPage(current: number, slideCount: number): number {
  if (slideCount <= 0) return 0;
  return (current + 1) % slideCount;
}

/**
 * Fill fraction for a stories-style segment bar.
 * Past slides = 1, upcoming = 0, active = `activeProgress` (0–1).
 */
export function introSegmentFill(
  segmentIndex: number,
  activeIndex: number,
  activeProgress: number,
): number {
  if (segmentIndex < activeIndex) return 1;
  if (segmentIndex > activeIndex) return 0;
  if (activeProgress <= 0) return 0;
  if (activeProgress >= 1) return 1;
  return activeProgress;
}

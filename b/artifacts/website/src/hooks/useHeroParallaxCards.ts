import { useRef } from "react";
import {
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { SCROLL_KEYFRAMES, offsetsForStrength } from "@/lib/heroParallax";

export interface HeroParallaxCardsResult {
  sectionRef: React.RefObject<HTMLElement | null>;
  propertyY: MotionValue<number>;
  rentY: MotionValue<number>;
  findTenantsY: MotionValue<number>;
  onTimeY: MotionValue<number>;
  galleryY: MotionValue<number>;
}

/** Shared scroll parallax for all hero floating cards. */
export function useHeroParallaxCards(): HeroParallaxCardsResult {
  const sectionRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const zeroOffsets = [0, 0, 0, 0, 0];

  const propertyRaw = useTransform(
    scrollYProgress,
    [...SCROLL_KEYFRAMES],
    prefersReducedMotion ? zeroOffsets : offsetsForStrength(18),
  );
  const rentRaw = useTransform(
    scrollYProgress,
    [...SCROLL_KEYFRAMES],
    prefersReducedMotion ? zeroOffsets : offsetsForStrength(14),
  );
  const findTenantsRaw = useTransform(
    scrollYProgress,
    [...SCROLL_KEYFRAMES],
    prefersReducedMotion ? zeroOffsets : offsetsForStrength(22),
  );
  const onTimeRaw = useTransform(
    scrollYProgress,
    [...SCROLL_KEYFRAMES],
    prefersReducedMotion ? zeroOffsets : offsetsForStrength(16),
  );
  const galleryRaw = useTransform(
    scrollYProgress,
    [...SCROLL_KEYFRAMES],
    prefersReducedMotion ? zeroOffsets : offsetsForStrength(20),
  );

  const springConfig = {
    stiffness: prefersReducedMotion ? 1000 : 120,
    damping: prefersReducedMotion ? 100 : 18,
    mass: 0.8,
  };

  const propertyY = useSpring(propertyRaw, springConfig);
  const rentY = useSpring(rentRaw, springConfig);
  const findTenantsY = useSpring(findTenantsRaw, springConfig);
  const onTimeY = useSpring(onTimeRaw, springConfig);
  const galleryY = useSpring(galleryRaw, springConfig);

  return { sectionRef, propertyY, rentY, findTenantsY, onTimeY, galleryY };
}

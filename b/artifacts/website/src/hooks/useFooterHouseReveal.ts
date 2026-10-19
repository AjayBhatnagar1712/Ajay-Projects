import { useRef } from "react";
import {
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

export interface FooterHouseRevealResult {
  sectionRef: React.RefObject<HTMLElement | null>;
  bannerY: MotionValue<string>;
  bannerOpacity: MotionValue<number>;
  footerOverlap: MotionValue<string>;
}

/** Scroll-driven banner reveal: rises from behind the footer, fully visible at end. */
export function useFooterHouseReveal(): FooterHouseRevealResult {
  const sectionRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const rawY = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ["0%", "0%"] : ["55%", "0%"],
  );
  const rawOpacity = useTransform(
    scrollYProgress,
    [0, 0.25, 1],
    prefersReducedMotion ? [1, 1, 1] : [0.75, 1, 1],
  );
  const rawFooterOverlap = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? ["0px", "0px"] : ["-420px", "0px"],
  );

  const springConfig = {
    stiffness: prefersReducedMotion ? 1000 : 90,
    damping: prefersReducedMotion ? 100 : 28,
  };

  const bannerY = useSpring(rawY, springConfig);
  const bannerOpacity = useSpring(rawOpacity, {
    stiffness: prefersReducedMotion ? 1000 : 120,
    damping: prefersReducedMotion ? 100 : 26,
  });
  const footerOverlap = useSpring(rawFooterOverlap, springConfig);

  return { sectionRef, bannerY, bannerOpacity, footerOverlap };
}

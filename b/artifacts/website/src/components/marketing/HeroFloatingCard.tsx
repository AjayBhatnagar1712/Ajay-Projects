import React from "react";
import { motion, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";

export interface HeroFloatingCardProps {
  children: React.ReactNode;
  className?: string;
  y: MotionValue<number>;
  delay?: number;
  /** Pre-rendered Figma assets include their own shadow and styling. */
  variant?: "card" | "asset";
}

export function HeroFloatingCard({
  children,
  className,
  y,
  delay = 0,
  variant = "card",
}: HeroFloatingCardProps) {
  return (
    <motion.div
      style={{ y }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        variant === "card" &&
          "rounded-lg bg-white shadow-[0_20px_60px_rgba(64,64,64,0.2)] ring-1 ring-marketing-border/80",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

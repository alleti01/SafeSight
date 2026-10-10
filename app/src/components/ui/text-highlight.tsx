"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// A marker-style highlight that sweeps across the text when it scrolls into
// view. Modeled on Fancy Components' Text Highlighter.
export function TextHighlight({
  children,
  className,
  color = "var(--danger)",
  delay = 0.4,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduceMotion = useReducedMotion();
  const on = inView || reduceMotion;

  return (
    <motion.span
      ref={ref}
      className={cn("box-decoration-clone px-1", className)}
      style={{
        backgroundImage: `linear-gradient(${color}, ${color})`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "left center",
      }}
      initial={{ backgroundSize: reduceMotion ? "100% 100%" : "0% 100%" }}
      animate={on ? { backgroundSize: "100% 100%", color: "#ffffff" } : undefined}
      transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay }}
    >
      {children}
    </motion.span>
  );
}

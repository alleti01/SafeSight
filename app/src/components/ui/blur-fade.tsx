"use client";

import { motion, useReducedMotion } from "motion/react";

// Fades content up out of a soft blur the first time it scrolls into view.
// Modeled on Magic UI's Blur Fade.
export function BlurFade({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "article" | "li";
}) {
  const reduceMotion = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      // Same first frame on the server and the client; with reduced motion
      // the content simply appears instead of drifting in.
      initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </Tag>
  );
}

import type { Transition, Variants } from "framer-motion";

export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };
export const softSpring: Transition = { type: "spring", stiffness: 260, damping: 28 };
export const ease: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] };

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...ease, duration: 0.5 } },
  exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.22 } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
};

export const fadeItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: ease },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16 } },
};

export const rowVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: Math.min(i, 12) * 0.025, duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  }),
};

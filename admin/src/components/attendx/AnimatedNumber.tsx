import * as React from "react";
import { useInView, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 22 });
  const [display, setDisplay] = React.useState(reduce ? value : 0);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (inView) mv.set(value);
  }, [inView, value, mv, reduce]);

  React.useEffect(() => {
    if (reduce) return;
    const unsub = spring.on("change", (v) => setDisplay(v));
    return () => unsub();
  }, [spring, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

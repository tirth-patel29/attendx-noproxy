import { cn } from "@/lib/utils";

/** Soft, slow-moving cyan ambient lighting for the page canvas. */
export function Ambient({ className, intensity = "soft" }: { className?: string; intensity?: "soft" | "strong" }) {
  const strong = intensity === "strong";
  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-canvas" />
      <div
        className={cn(
          "ambient-orb absolute -top-40 -left-24 size-[46rem] rounded-full blur-3xl",
          strong ? "opacity-70" : "opacity-40",
        )}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.85 0.09 202 / 0.55), transparent 65%)",
        }}
      />
      <div
        className={cn(
          "ambient-orb absolute -top-24 right-[-10rem] size-[38rem] rounded-full blur-3xl",
          strong ? "opacity-60" : "opacity-30",
        )}
        style={{
          animationDelay: "-6s",
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.84 0.07 262 / 0.5), transparent 65%)",
        }}
      />
      <div
        className="ambient-orb absolute bottom-[-16rem] left-1/3 size-[40rem] rounded-full opacity-30 blur-3xl"
        style={{
          animationDelay: "-11s",
          background:
            "radial-gradient(circle at 50% 50%, oklch(0.88 0.06 190 / 0.45), transparent 65%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.6 0.02 240 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.6 0.02 240 / 0.06) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(70% 60% at 50% 0%, black, transparent)",
        }}
      />
    </div>
  );
}

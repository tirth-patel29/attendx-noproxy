import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-xl bg-gradient-cyan shadow-[0_6px_18px_-8px_oklch(0.6_0.13_220/0.7)]",
        "size-9",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5 text-primary-foreground">
        <path
          d="M12 2.5 20 6v6.2c0 4.4-3.2 7.9-8 9.3-4.8-1.4-8-4.9-8-9.3V6l8-3.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity="0.9"
        />
        <path
          d="m8.6 12.2 2.5 2.5 4.4-4.9"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/40" />
    </div>
  );
}

export function Logo({
  subtitle,
  className,
}: {
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <LogoMark />
      <div className="min-w-0 leading-none">
        <div className="truncate text-[15px] font-semibold tracking-[-0.03em]">AttendX</div>
        {subtitle ? (
          <div className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {subtitle}
          </div>
        ) : null}
      </div>
    </div>
  );
}

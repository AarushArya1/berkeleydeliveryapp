import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lime";
type Size = "md" | "lg" | "sm";

const variants: Record<Variant, string> = {
  primary: "bg-action text-white hover:bg-action-hover active:bg-action-hover shadow-[0_4px_14px_rgb(107_60_242/0.25)] disabled:shadow-none",
  secondary: "bg-white text-ink border border-line hover:bg-lime-25",
  ghost: "bg-transparent text-action hover:bg-action-soft",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger-soft",
  lime: "bg-lime-300 text-lime-900 hover:bg-lime-400",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl",
  md: "h-12 px-5 text-[15px] rounded-2xl",
  lg: "h-14 px-6 text-base rounded-2xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", full = false) {
  return clsx(
    "inline-flex items-center justify-center gap-2 font-semibold transition-colors select-none",
    "disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    full && "w-full",
  );
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  loading,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; full?: boolean; loading?: boolean }) {
  return (
    <button className={clsx(buttonClass(variant, size, full), className)} disabled={loading || props.disabled} {...props}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  full,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; full?: boolean }) {
  return <Link className={clsx(buttonClass(variant, size, full), className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-card border border-line bg-white shadow-card", className)} {...props} />;
}

export function Chip({
  selected,
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={clsx(
        "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors",
        selected ? "border-action bg-action text-white" : "border-line bg-white text-ink hover:border-lime-300 hover:bg-lime-25",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ children, hint, htmlFor }: { children: ReactNode; hint?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-2">
      <span className="text-sm font-bold text-ink">{children}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-line bg-white px-4 text-ink placeholder:text-muted/70 outline-none transition focus:border-action focus:ring-4 focus:ring-action/10";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(fieldClass, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(fieldClass, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(fieldClass, "h-12 appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10", className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2366705c' stroke-width='2.5' stroke-linecap='round'><path d='m6 9 6 6 6-6'/></svg>\")" }} {...props} />;
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={clsx("flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-ink", className)}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-action" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
      {children}
    </p>
  );
}

export function Notice({ tone = "lime", children, className }: { tone?: "lime" | "warn" | "action"; children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
        tone === "lime" && "bg-lime-50 text-lime-900",
        tone === "warn" && "bg-warn-soft text-warn-ink",
        tone === "action" && "bg-action-soft text-action-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-action/40 bg-action-soft px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-action-ink">
      {children}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between first:mt-0">
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-lime-100 text-lime-700">{icon}</div>
      <p className="text-lg font-bold text-ink">{title}</p>
      {children ? <div className="mt-1.5 max-w-xs text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-lime-50", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}

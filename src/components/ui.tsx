import Link from "next/link";
import { forwardRef } from "react";

export const cn = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] touch-manipulation";
const variants: Record<Variant, string> = {
  primary:
    "bg-teal bg-gradient-to-b from-[#1a9a8f] to-teal text-white shadow-[0_1px_0_rgb(255_255_255/0.35)_inset,0_8px_20px_-10px_rgb(15_118_110/0.9)] hover:from-teal hover:to-teal-deep",
  secondary: "bg-card text-ink ring-1 ring-line hover:ring-ink-faint/50",
  ghost: "text-teal hover:bg-teal-soft",
};
const sizes = {
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-base",
  sm: "h-9 px-3.5 text-sm",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: keyof typeof sizes;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", className, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      />
    );
  },
);

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: keyof typeof sizes;
}) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    />
  );
}

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)]",
        className,
      )}
      {...rest}
    />
  );
}

export function SectionTitle({
  children,
  id,
  hint,
}: {
  children: React.ReactNode;
  id?: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2
        id={id}
        className="text-[1.375rem] leading-tight font-medium text-ink"
      >
        {children}
      </h2>
      {hint ? <p className="text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** Formatta un voto in italiano: 7,5/10 oppure 82/100. */
export function formatScore(score: number | null, max: 10 | 100) {
  if (score == null) return "–";
  const n =
    max === 100
      ? Math.round(score).toString()
      : score.toLocaleString("it-IT", { maximumFractionDigits: 1 });
  return `${n}/${max}`;
}

const dateFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
});
const dateTimeFmt = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) =>
  dateTimeFmt.format(new Date(iso));

export function formatBytes(n: number | null) {
  if (n == null) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} kB`;
  return `${(n / 1024 / 1024).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`;
}

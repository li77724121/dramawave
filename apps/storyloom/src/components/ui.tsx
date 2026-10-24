import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "plain";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary",
  ghost: "btn-ghost",
  plain: "btn text-white/60 hover:text-white",
};

export function Button({ variant = "ghost", className, ...props }: ButtonProps) {
  return <button {...props} className={cn(VARIANTS[variant], className)} />;
}

export function TextInput({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="label">{label}</span> : null}
      <input {...props} className={cn("field", className)} />
    </label>
  );
}

export function TextArea({
  label,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="label">{label}</span> : null}
      <textarea {...props} className={cn("field resize-y leading-relaxed", className)} />
    </label>
  );
}

export function Select({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? <span className="label">{label}</span> : null}
      <select {...props} className={cn("field appearance-none", className)}>
        {children}
      </select>
    </label>
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "ok" | "warn" | "busy" }) {
  const tones = {
    muted: "border-white/10 bg-white/[0.04] text-white/55",
    ok: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    warn: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    busy: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]", tones[tone])}>{children}</span>;
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/12 bg-ink-900/40 px-4 py-10 text-center">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-1 text-[11.5px] text-white/35">{hint}</p>
    </div>
  );
}

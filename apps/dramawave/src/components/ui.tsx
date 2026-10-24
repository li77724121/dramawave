import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

type Variant = "primary" | "ghost" | "plain";

export function Button({
  variant = "ghost",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const cls = variant === "primary" ? "btn-primary" : variant === "plain" ? "btn text-white/60 hover:text-white" : "btn-ghost";
  return <button {...props} className={cn(cls, className)} />;
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

export function Modal({
  open,
  title,
  onClose,
  dismissible = true,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** 关闭按钮与点击遮罩关闭；必填流程可设为 false。 */
  dismissible?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    // 捕获阶段拦截 Esc，避免同时在播放器上触发两个关闭动作。
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !dismissible) return;
      event.stopPropagation();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, dismissible]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-850 p-4 shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-white">{title}</h3>
          {dismissible ? (
            <button type="button" className="text-white/40 hover:text-white" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/12 px-4 py-10 text-center">
      <p className="text-sm text-white/70">{title}</p>
      <p className="mt-1 text-[11.5px] text-white/35">{hint}</p>
    </div>
  );
}

import { Children, isValidElement, useEffect, useMemo, useRef, useState } from "react";
import type { ButtonHTMLAttributes, ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 overflow-hidden rounded-[28px] border border-white/80 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/88 dark:shadow-[0_18px_70px_rgba(0,0,0,0.35)] ${className}`}>{children}</section>;
}

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)] transition active:scale-[0.98] disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 dark:shadow-[0_12px_28px_rgba(16,185,129,0.20)] ${className}`}
      {...props}
    />
  );
}

export function GhostButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 transition active:scale-[0.98] dark:bg-white/10 dark:text-slate-100 ${className}`}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500" {...props} />;
}

export function Select({ children, name, defaultValue, value, onChange, disabled }: SelectHTMLAttributes<HTMLSelectElement>) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const options = useMemo(
    () =>
      Children.toArray(children)
        .filter(isValidElement)
        .map((child) => {
          const props = child.props as { value?: string; children?: ReactNode };
          const label = String(props.children ?? props.value ?? "");
          return { label, value: String(props.value ?? label) };
        }),
    [children],
  );
  const [draft, setDraft] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const selected = String(value ?? draft);
  const label = options.find((option) => option.value === selected)?.label || selected;

  useEffect(() => {
    if (!open) return;
    const update = () => setRect(buttonRef.current?.getBoundingClientRect() || null);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return (
    <div className="relative min-w-0">
      <input type="hidden" name={name} value={selected} />
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((item) => !item)}
        className={`flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border px-4 text-left text-sm font-black shadow-[0_10px_24px_rgba(15,23,42,0.06)] outline-none transition active:scale-[0.99] disabled:opacity-50 ${open ? "border-emerald-500 bg-emerald-50 text-slate-950 dark:bg-emerald-500/12 dark:text-white" : "border-slate-200 bg-white text-slate-950 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"}`}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span className={`shrink-0 text-lg leading-none text-emerald-500 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && rect && (
        <div
          className="fixed z-[120] overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-2 shadow-[0_24px_70px_rgba(15,23,42,0.24)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/95 dark:shadow-[0_24px_80px_rgba(0,0,0,0.58)]"
          style={{ left: rect.left, top: rect.bottom + 8, width: rect.width, maxHeight: Math.min(280, window.innerHeight - rect.bottom - 24) }}
        >
          <div className="premium-scroll max-h-[inherit] overflow-y-auto pr-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (value === undefined) setDraft(option.value);
                  setOpen(false);
                  onChange?.({ target: { value: option.value, name } } as unknown as ChangeEvent<HTMLSelectElement>);
                }}
                className={`mb-1 flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black transition last:mb-0 ${option.value === selected ? "bg-emerald-500 text-white shadow-[0_12px_28px_rgba(16,185,129,0.25)]" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"}`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {option.value === selected && <span className="shrink-0">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-slate-950/60 dark:text-white dark:placeholder:text-slate-500" {...props} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
      {label}
      {children}
    </label>
  );
}

export function ProgressBar({ value, tone = "emerald" }: { value: number; tone?: "emerald" | "amber" | "red" | "slate" }) {
  const colors = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-slate-950",
  };
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
      <div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function StatCard({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "green" | "red" | "amber" }) {
  const color = tone === "green" ? "text-emerald-600 dark:text-emerald-400" : tone === "red" ? "text-red-600 dark:text-red-400" : tone === "amber" ? "text-amber-600 dark:text-amber-300" : "text-slate-950 dark:text-white";
  const bg = tone === "green" ? "bg-emerald-50 dark:bg-emerald-500/10" : tone === "red" ? "bg-red-50 dark:bg-red-500/10" : tone === "amber" ? "bg-amber-50 dark:bg-amber-500/10" : "bg-white dark:bg-slate-900";
  return (
    <Card className={`${bg} p-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)]`}>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </Card>
  );
}

export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/55 px-3 pb-3 pt-12 backdrop-blur-sm">
      <div className="mx-auto flex max-h-full w-full max-w-md min-w-0 flex-col overflow-hidden rounded-t-[30px] border border-white/70 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="min-w-0 truncate text-base font-bold text-slate-950 dark:text-white">{title}</h2>
          <button className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200" onClick={onClose}>Close</button>
        </div>
        <div className="premium-scroll min-h-0 min-w-0 overflow-x-hidden overflow-y-auto p-5 pr-4">{children}</div>
      </div>
    </div>
  );
}

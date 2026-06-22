import * as React from "react";
import { cn } from "@/lib/utils";

export function AuthPageBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-gradient-to-br from-amber-50/80 via-background to-primary/5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

export function AuthCardHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="relative bg-gradient-to-r from-primary to-primary/85 px-8 pb-8 pt-10 text-center text-primary-foreground">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
      <div className="relative">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg">
          <img src="/logo.png" alt="P4U" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-xs text-primary-foreground/70">{subtitle}</p>
      </div>
    </div>
  );
}

const WIZARD_STEPS = ["Details", "KYC & Documents", "Bank", "Review"] as const;

export function WizardStepBar({
  step,
  onStepClick,
}: {
  step: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-border/60 pb-4">
      {WIZARD_STEPS.map((label, i) => (
        <button
          key={label}
          type="button"
          disabled={!onStepClick || i > step}
          onClick={() => onStepClick?.(i)}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition",
            i === step
              ? "bg-primary text-primary-foreground shadow-sm"
              : i < step
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
          )}
        >
          {i + 1}. {label}
        </button>
      ))}
    </div>
  );
}

export function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-border/40 py-2 text-sm">
      <span className="min-w-[140px] font-medium text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || "—"}</span>
    </div>
  );
}

export function OtpInputRow({
  otp,
  otpLen,
  otpRefs,
  error,
  onChange,
  onKeyDown,
  onPaste,
}: {
  otp: string[];
  otpLen: number;
  otpRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  error?: boolean;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
}) {
  return (
    <div className="flex justify-center gap-2" onPaste={onPaste}>
      {otp.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            otpRefs.current[i] = el;
          }}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => onChange(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          className={cn(
            "h-12 w-10 rounded-xl border text-center text-base font-semibold outline-none transition focus:ring-2 focus:ring-primary/30",
            digit ? "border-primary bg-primary/5" : error ? "border-destructive" : "border-input bg-background",
          )}
        />
      ))}
    </div>
  );
}

import { CircleAlert, CircleCheck, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

/** `compact` renders icon-only (with an accessible label) for dense phone rows. */
export function SignedBadge({ signed, compact = false, className }: { signed: boolean; compact?: boolean; className?: string }) {
  const Icon = signed ? CircleCheck : CircleDashed;
  const label = signed ? "Signed" : "Unsigned";
  if (compact) {
    return (
      <span className={cn("shrink-0", signed ? "text-success" : "text-warning", className)} title={label}>
        <Icon className="size-[18px]" aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        signed ? "bg-success/12 text-success" : "bg-warning/14 text-warning",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden /> {label}
    </span>
  );
}

export function OpenBadge({ open }: { open: boolean }) {
  return open ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-medium text-destructive">
      <CircleAlert className="size-3.5" aria-hidden /> Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
      <CircleCheck className="size-3.5" aria-hidden /> Resolved
    </span>
  );
}

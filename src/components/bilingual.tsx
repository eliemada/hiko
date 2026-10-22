import { cn } from "@/lib/utils";

/**
 * English label with the official MLIT field name as a small hint, so foreign
 * pilots can match each field to the Japanese form when an inspector asks.
 */
export function BiLabel({ ja, en, className, htmlFor }: { ja?: string; en: string; className?: string; htmlFor?: string }) {
  const Tag = htmlFor ? "label" : "div";
  return (
    <Tag htmlFor={htmlFor} className={cn("flex items-baseline justify-between gap-2", className)}>
      <span className="text-sm leading-5 font-medium">{en}</span>
      {ja && <span className="label-ja">{ja}</span>}
    </Tag>
  );
}

export function PageHeader({
  title,
  kicker,
  description,
  actions,
}: {
  title: string;
  kicker?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {kicker && <p className="label-en">{kicker}</p>}
        <h1 className="text-2xl leading-8 font-semibold tracking-tight md:text-[28px] md:leading-9">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 empty:hidden">{actions}</div>}
    </div>
  );
}

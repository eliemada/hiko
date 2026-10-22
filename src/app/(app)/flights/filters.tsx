"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name: string;
}

const ALL = "__all";

export function FlightFilters({ aircraft, pilots }: { aircraft: Option[]; pilots: Option[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string | null) => {
    const q = new URLSearchParams(params);
    if (value) q.set(key, value);
    else q.delete(key);
    q.delete("page");
    start(() => router.replace(`${pathname}?${q}`, { scroll: false }));
  };

  const activeCount = ["aircraft", "pilot", "from", "to", "unsigned"].filter((k) => params.has(k)).length;
  const active = activeCount > 0;
  const [open, setOpen] = useState(false);
  const unsignedOnly = params.get("unsigned") === "1";

  return (
    <>
      {/* Phone: one row — quick "unsigned" chip + a Filter button opening a bottom sheet. */}
      <div className={cn("flex items-center gap-2 md:hidden", pending && "opacity-60")}>
        <button
          type="button"
          onClick={() => set("unsigned", unsignedOnly ? null : "1")}
          className={cn(
            "h-9 rounded-full border px-3.5 text-sm font-medium",
            unsignedOnly ? "border-warning/50 bg-warning/12 text-warning" : "text-muted-foreground",
          )}
        >
          Unsigned
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
            activeCount - (unsignedOnly ? 1 : 0) > 0 ? "border-primary/50 bg-accent text-accent-foreground" : "text-muted-foreground",
          )}
        >
          <SlidersHorizontal className="size-4" /> Filter
          {activeCount - (unsignedOnly ? 1 : 0) > 0 && <span className="tnum">· {activeCount - (unsignedOnly ? 1 : 0)}</span>}
        </button>
        {active && (
          <button type="button" onClick={() => start(() => router.replace(pathname))} className="ml-auto text-sm text-primary">
            Clear
          </button>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetHeader>
              <SheetTitle>Filter flights</SheetTitle>
            </SheetHeader>
            <div className="grid gap-3 px-4 [&_button[role=combobox]]:h-11 [&_button[role=combobox]]:w-full [&_input]:h-11 [&_input]:w-full">
              <Controls />
              <Button size="lg" onClick={() => setOpen(false)}>
                Show flights
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className={cn("hidden flex-wrap items-center gap-2 transition-opacity md:flex", pending && "opacity-60")}>
        <Controls />
        <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
          <Switch checked={unsignedOnly} onCheckedChange={(on) => set("unsigned", on ? "1" : null)} />
          Unsigned only
        </label>
        {active && (
          <Button variant="ghost" size="sm" onClick={() => start(() => router.replace(pathname))}>
            <X /> Clear
          </Button>
        )}
      </div>
    </>
  );

  function Controls() {
    return (
      <>
      <Select value={params.get("pilot") ?? ALL} onValueChange={(v) => set("pilot", v === ALL ? null : v)}>
        <SelectTrigger className="w-44" aria-label="Pilot">
          <SelectValue placeholder="All pilots" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All pilots</SelectItem>
          <SelectItem value="me">Me</SelectItem>
          {pilots.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("aircraft") ?? ALL} onValueChange={(v) => set("aircraft", v === ALL ? null : v)}>
        <SelectTrigger className="w-48" aria-label="Aircraft">
          <SelectValue placeholder="All aircraft" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All aircraft</SelectItem>
          {aircraft.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          aria-label="From"
          className="w-40"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => set("from", e.target.value || null)}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="date"
          aria-label="To"
          className="w-40"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => set("to", e.target.value || null)}
        />
      </div>
      </>
    );
  }
}

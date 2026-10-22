"use client";

import { BookOpenText, Drone, Home, List, LogOut, Menu, Monitor, Moon, Plus, Settings, Sun, Upload, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { isActive } from "./app-sidebar";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/flights", label: "Flights", icon: List },
  { href: "/import", label: "Import", icon: Upload, primary: true },
  { href: "/log", label: "Log", icon: BookOpenText },
] as const;

const MORE = [
  { href: "/aircraft", label: "Aircraft", icon: Drone },
  { href: "/squawks", label: "Squawks", icon: Wrench },
  { href: "/flights/new", label: "Manual entry", icon: Plus },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

/**
 * Phone navigation: thumb-reachable tab bar with Import as the central action,
 * everything else one tap away in a bottom sheet. Hidden from md up.
 */
export function MobileNav({ user, unsigned }: { user: { name: string; email: string }; unsigned: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((m) => isActive(pathname, m.href)) && !isActive(pathname, "/flights");

  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid h-16 grid-cols-5 items-center">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href) && !(tab.href === "/flights" && pathname === "/flights/new");
          if ("primary" in tab) {
            return (
              <li key={tab.href} className="grid place-items-center">
                <Link
                  href={tab.href}
                  aria-label="Import flight records"
                  className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_6px_16px_-4px_var(--primary)] transition-transform active:scale-95"
                >
                  <tab.icon className="size-5" aria-hidden />
                </Link>
              </li>
            );
          }
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:opacity-60",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <tab.icon className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {tab.label}
                {tab.href === "/flights" && unsigned > 0 && (
                  <span className="absolute top-2 right-[calc(50%-20px)] grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] font-semibold text-warning-foreground tnum">
                    {unsigned}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium active:opacity-60",
              moreActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Menu className="size-[22px]" strokeWidth={1.75} aria-hidden />
            More
          </button>
        </li>
      </ul>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pb-0">
            <SheetTitle className="text-left">{user.name}</SheetTitle>
            <p className="text-left text-sm text-muted-foreground">{user.email}</p>
          </SheetHeader>
          <ul className="grid grid-cols-2 gap-2 px-4">
            {MORE.map((m) => (
              <li key={m.href}>
                <Link
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex h-14 items-center gap-3 rounded-xl border px-4 text-sm font-medium active:bg-accent",
                    isActive(pathname, m.href) && "border-primary/40 bg-accent text-accent-foreground",
                  )}
                >
                  <m.icon className="size-5 text-muted-foreground" aria-hidden />
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-2 px-4">
            <div className="flex rounded-xl border p-1" role="radiogroup" aria-label="Theme">
              {(
                [
                  ["light", Sun],
                  ["dark", Moon],
                  ["system", Monitor],
                ] as const
              ).map(([value, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  aria-label={value}
                  onClick={() => setTheme(value)}
                  className={cn("grid size-10 place-items-center rounded-lg", theme === value && "bg-accent text-accent-foreground")}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/sign-in");
                router.refresh();
              }}
              className="flex h-12 items-center gap-2 rounded-xl px-4 text-sm font-medium text-destructive active:bg-destructive/10"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}

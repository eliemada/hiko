import { and, count, eq, isNull } from "drizzle-orm";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { db } from "@/lib/db";
import { flight } from "@/lib/db/schema";
import { requireUser } from "@/lib/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [{ n }] = await db
    .select({ n: count() })
    .from(flight)
    .where(and(eq(flight.pilotId, user.id), isNull(flight.signedAt)));

  return (
    <SidebarProvider>
      <AppSidebar user={user} unsigned={n} />
      <SidebarInset>
        {/* Phones: no top bar — content starts under the status bar, nav lives at the thumb. */}
        <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-8 md:pb-10">
          {children}
        </div>
      </SidebarInset>
      <MobileNav user={{ name: user.name, email: user.email }} unsigned={n} />
    </SidebarProvider>
  );
}

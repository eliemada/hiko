import { Logo } from "@/components/app-sidebar";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-4 py-12">
      <div className="relative w-full max-w-[400px] space-y-6">
        <Logo className="justify-center" />
        {children}
        <p className="text-center text-xs text-muted-foreground">
          Your flight records in Japan’s MLIT Form 1 format, in English.
        </p>
      </div>
    </main>
  );
}

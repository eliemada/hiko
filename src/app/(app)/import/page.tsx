import { KeyRound, Smartphone, Tablet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/bilingual";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasDjiApiKey } from "@/lib/dji/decode";
import { requireUser } from "@/lib/server/session";
import { Importer } from "./importer";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage() {
  await requireUser();
  const keyConfigured = hasDjiApiKey();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Import flight records"
        description="Each DJI Fly log becomes one row per takeoff, with real airborne times, address, weather and MLIT specific-flight hints filled in."
      />

      {!keyConfigured && (
        <Alert className="border-warning/40 bg-warning/8">
          <KeyRound className="text-warning" />
          <AlertTitle>DJI API key not configured</AlertTitle>
          <AlertDescription>
            Logs from recent DJI Fly versions are encrypted. Without <code className="font-mono">DJI_API_KEY</code>, only the
            log header is read and takeoff/landing times are estimated. <Link href="/settings#dji" className="font-medium text-primary underline-offset-4 hover:underline">How to get a key →</Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Importer />
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Where are my logs?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex gap-3">
              <Tablet className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-medium">DJI RC 2 / RC Pro 2 · Android</p>
                <p className="text-muted-foreground">
                  Connect via USB →{" "}
                  <code className="font-mono text-xs break-all">Android/data/dji.go.v5/files/FlightRecord/</code>
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Smartphone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="font-medium">iPhone</p>
                <p className="text-muted-foreground">
                  Finder → your iPhone → Files → DJI Fly → <code className="font-mono text-xs">FlightRecords</code>
                </p>
              </div>
            </div>
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Re-importing the same file is safe — duplicates are detected. Raw logs and decryption keys are archived so
              flights can be re-processed offline.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { CheckCircle2, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/bilingual";
import { SignatureEditor } from "@/components/signature-pad";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { hasDjiApiKey } from "@/lib/dji/decode";
import { listPilots } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { CopyInvite, ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireUser();
  const [row, pilots] = await Promise.all([db.query.user.findFirst({ where: eq(user.id, me.id) }), listPilots()]);
  const isAdmin = me.role === "admin";
  const keyOk = hasDjiApiKey();
  const invite = isAdmin ? (process.env.INVITE_CODE ?? null) : null;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Printed as the pilot (③) on every flight you log.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={me.name} licenseNumber={me.licenseNumber ?? ""} />
        </CardContent>
      </Card>

      <Card id="signature">
        <CardHeader>
          <CardTitle className="text-base">Signature</CardTitle>
          <CardDescription>Applied when you sign a flight. Draw with a finger, stylus or mouse.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignatureEditor initial={row?.signature ?? null} />
        </CardContent>
      </Card>

      <Card id="dji">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            DJI API key
            {keyOk ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/14 px-2 py-0.5 text-xs font-medium text-warning">
                <CircleAlert className="size-3.5" /> Missing
              </span>
            )}
          </CardTitle>
          <CardDescription>DJI Fly encrypts flight records (v13+). The key lets the server fetch each log&apos;s decryption keychain from DJI once.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>
              Sign in at <a className="text-primary hover:underline" href="https://developer.dji.com/user" target="_blank" rel="noreferrer">developer.dji.com</a>.
            </li>
            <li>
              <strong className="text-foreground">Create App</strong> → App Type <strong className="text-foreground">Open API</strong>, any name/category.
            </li>
            <li>Activate it from the email DJI sends you.</li>
            <li>
              Copy the <strong className="text-foreground">SDK key</strong> into <code className="font-mono">DJI_API_KEY</code> in the server&apos;s <code className="font-mono">.env</code> and restart.
            </li>
          </ol>
          <p className="text-xs text-muted-foreground">Keychains are stored with each log, so re-processing never needs DJI again.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pilots</CardTitle>
          <CardDescription>Everyone shares the fleet log; each pilot signs their own flights.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="divide-y rounded-md border">
            {pilots.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.email}
                    {p.licenseNumber && ` · ${p.licenseNumber}`}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{p.role === "admin" ? "Admin" : "Pilot"}</span>
              </li>
            ))}
          </ul>
          {isAdmin && (
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Invite a pilot</p>
              {invite ? (
                <CopyInvite code={invite} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set <code className="font-mono">INVITE_CODE</code> in the server environment to let other pilots sign up.
                </p>
              )}
              <p className="text-xs text-muted-foreground">Share the sign-up link and this code. Rotate it by changing the env var.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

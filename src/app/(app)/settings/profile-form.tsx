"use client";

import { Copy } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/fleet";
import { BiLabel } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileForm({ name, licenseNumber }: { name: string; licenseNumber: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = Object.fromEntries(new FormData(e.currentTarget));
        start(async () => {
          const res = await updateProfile(form);
          if (res.success) toast.success("Profile saved");
          else toast.error(res.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <BiLabel ja="氏名" en="Name as printed" htmlFor="name" />
          <Input id="name" name="name" required defaultValue={name} />
        </div>
        <div className="space-y-2">
          <BiLabel ja="技能証明番号" en="Japanese pilot certificate no. (optional)" htmlFor="licenseNumber" />
          <Input id="licenseNumber" name="licenseNumber" className="font-mono" defaultValue={licenseNumber} />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}

export function CopyInvite({ code }: { code: string }) {
  const copy = async () => {
    const text = `Sign up at ${window.location.origin}/sign-up with invite code: ${code}`;
    await navigator.clipboard.writeText(text);
    toast.success("Invite copied");
  };
  return (
    <div className="flex items-center gap-2">
      <code className="rounded-md border bg-muted px-3 py-1.5 font-mono text-sm">{code}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        <Copy /> Copy invite
      </Button>
    </div>
  );
}

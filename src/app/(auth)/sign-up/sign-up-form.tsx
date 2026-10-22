"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signUp } from "@/app/actions/auth";
import { BiLabel } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SignUpForm({ firstUser }: { firstUser: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    start(async () => {
      const res = await signUp({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        inviteCode: form.get("inviteCode") ?? "",
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.push(firstUser ? "/aircraft" : "/");
      router.refresh();
    });
  }

  return (
    <Card className="shadow-[0_8px_32px_oklch(0_0_0/0.08)]">
      <CardHeader>
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>
          {firstUser
            ? "You're the first pilot — this account becomes the fleet admin."
            : "Ask your fleet admin for the invite code."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <BiLabel en="Full name (as printed on the log)" htmlFor="name" />
            <Input id="name" name="name" autoComplete="name" required className="h-10 text-base" placeholder="Alex Smith" />
          </div>
          <div className="space-y-2">
            <BiLabel en="Email" htmlFor="email" />
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-10 text-base" />
          </div>
          <div className="space-y-2">
            <BiLabel en="Password · 10+ characters" htmlFor="password" />
            <Input id="password" name="password" type="password" minLength={10} autoComplete="new-password" required className="h-10 text-base" />
          </div>
          {!firstUser && (
            <div className="space-y-2">
              <BiLabel en="Invite code" htmlFor="inviteCode" />
              <Input id="inviteCode" name="inviteCode" required autoComplete="off" className="h-10 font-mono text-base" />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="h-10 w-full" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Create account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/sign-in" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

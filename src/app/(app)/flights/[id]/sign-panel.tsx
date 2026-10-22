"use client";

import { PenLine, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteFlight, signFlight, unsignFlight } from "@/app/actions/flights";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Props {
  flightId: string;
  signedAt: string | null;
  isPilot: boolean;
  canEdit: boolean;
  pilotName: string;
  signature: string | null;
}

export function SignPanel({ flightId, signedAt, isPilot, canEdit, pilotName, signature }: Props) {
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const res = await fn();
      if (res.success) toast.success(ok);
      else toast.error(res.error ?? "Failed");
    });

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Pilot signature</span>
        <span className="label-ja">⑪ 飛行させた者の署名</span>
      </div>
      <div className="grid h-24 place-items-center rounded-md border bg-paper">
        {signedAt && signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={signature} alt={`Signature of ${pilotName}`} className="max-h-20 object-contain" />
        ) : (
          <span className="text-xs text-slate-400">{signedAt ? "Signed" : "Not signed yet"}</span>
        )}
      </div>
      {signedAt && (
        <p className="text-xs text-muted-foreground tnum">
          {pilotName} · {new Date(signedAt).toLocaleString("ja-JP")}
        </p>
      )}

      {!signedAt && isPilot && (
        signature ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="h-11 w-full" disabled={pending}>
                <PenLine /> Review & sign
              </Button>
            </DialogTrigger>
            {/* Phone: the same action pinned above the tab bar, always in thumb reach. */}
            <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/92 px-4 py-2.5 backdrop-blur-xl md:hidden">
              <DialogTrigger asChild>
                <Button size="lg" className="h-12 w-full text-base" disabled={pending}>
                  <PenLine /> Review & sign
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sign this flight?</DialogTitle>
                <DialogDescription>
                  By signing you confirm the entries are accurate. The core fields lock until the signature is removed.
                </DialogDescription>
              </DialogHeader>
              <div className="grid h-28 place-items-center rounded-md border bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={signature} alt="Your signature" className="max-h-24 object-contain" />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button onClick={() => act(() => signFlight(flightId), "Flight signed")}>
                    <PenLine /> Sign
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link href="/settings#signature">Draw your signature first →</Link>
            </Button>
            <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/92 px-4 py-2.5 backdrop-blur-xl md:hidden">
              <Button asChild size="lg" variant="outline" className="h-12 w-full">
                <Link href="/settings#signature">Draw your signature to sign</Link>
              </Button>
            </div>
          </>
        )
      )}
      {!signedAt && !isPilot && <p className="text-xs text-muted-foreground">Only {pilotName} can sign this flight.</p>}

      <div className="flex gap-2">
        {signedAt && canEdit && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => act(() => unsignFlight(flightId), "Signature removed")}>
            <Undo2 /> Remove signature
          </Button>
        )}
        {!signedAt && canEdit && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 /> Delete flight
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete this flight?</DialogTitle>
                <DialogDescription>It will disappear from the journey log and totals. Re-importing the log brings it back.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => act(() => deleteFlight(flightId), "Deleted")}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

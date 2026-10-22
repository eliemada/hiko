"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSquawk, saveSquawk } from "@/app/actions/fleet";
import { BiLabel } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Existing {
  id: string;
  aircraftId: string;
  occurredOn: string;
  description: string;
  actionOn: string;
  action: string;
  confirmer: string;
}

const today = () => new Date().toISOString().slice(0, 10);

export function SquawkDialog({
  aircraft,
  squawk,
  canDelete = false,
}: {
  aircraft: { id: string; name: string }[];
  squawk?: Existing;
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [aircraftId, setAircraftId] = useState(squawk?.aircraftId ?? aircraft[0]?.id ?? "");
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    start(async () => {
      const res = await saveSquawk(squawk?.id ?? null, { ...form, aircraftId });
      if (!res.success) return void toast.error(res.error);
      toast.success("Saved");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {squawk ? (
          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit squawk">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> Add squawk
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{squawk ? "Update squawk" : "Report a squawk"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <BiLabel ja="機体" en="Aircraft" />
              <Select value={aircraftId} onValueChange={setAircraftId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <BiLabel ja="発生年月日" en="Squawk date" htmlFor="occurredOn" />
              <Input id="occurredOn" name="occurredOn" type="date" required defaultValue={squawk?.occurredOn ?? today()} />
            </div>
          </div>
          <div className="space-y-2">
            <BiLabel ja="不具合事項" en="Flight squawk" htmlFor="description" />
            <Textarea id="description" name="description" required rows={2} defaultValue={squawk?.description} placeholder="e.g. Propeller tip chipped (プロペラ先端の欠け)" />
          </div>
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-3 text-xs text-muted-foreground">Corrective action · fill in once resolved</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <BiLabel ja="処置年月日" en="Action date" htmlFor="actionOn" />
                <Input id="actionOn" name="actionOn" type="date" defaultValue={squawk?.actionOn} />
              </div>
              <div className="space-y-2">
                <BiLabel ja="確認者" en="Confirmer" htmlFor="confirmer" />
                <Input id="confirmer" name="confirmer" defaultValue={squawk?.confirmer} />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <BiLabel ja="処置その他" en="Corrective action" htmlFor="action" />
              <Textarea id="action" name="action" rows={2} defaultValue={squawk?.action} placeholder="e.g. Propeller replaced, test flight OK" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {squawk && canDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteSquawk(squawk.id);
                    if (res.success) setOpen(false);
                    else toast.error(res.error);
                  })
                }
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

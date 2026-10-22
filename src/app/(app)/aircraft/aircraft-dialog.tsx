"use client";

import { Pencil, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createAircraft, setAircraftArchived, updateAircraft } from "@/app/actions/fleet";
import { BiLabel } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Existing {
  id: string;
  name: string;
  model: string;
  registrationId: string;
  serialNumber: string;
  initialHours: number;
  archived: boolean;
}

export function AircraftDialog(props: { mode: "create" } | { mode: "edit"; aircraft: Existing }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const a = props.mode === "edit" ? props.aircraft : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    start(async () => {
      const res = a ? await updateAircraft(a.id, form) : await createAircraft(form);
      if (!res.success) return void toast.error(res.error);
      toast.success(a ? "Aircraft updated" : "Aircraft added");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {a ? (
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Edit ${a.name}`}>
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> Add aircraft
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{a ? "Edit aircraft" : "Add aircraft"}</DialogTitle>
          <DialogDescription>Printed at the top of the journey log: registration ID, or model and serial if not registered.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <BiLabel ja="名称" en="Name" htmlFor="name" />
              <Input id="name" name="name" required defaultValue={a?.name ?? "Mavic 4 Pro"} />
            </div>
            <div className="space-y-2">
              <BiLabel ja="型式" en="Model" htmlFor="model" />
              <Input id="model" name="model" defaultValue={a?.model ?? "DJI Mavic 4 Pro"} />
            </div>
            <div className="space-y-2">
              <BiLabel ja="登録記号" en="Registration ID (JU…)" htmlFor="registrationId" />
              <Input id="registrationId" name="registrationId" className="font-mono" placeholder="JU1234567890" defaultValue={a?.registrationId} />
            </div>
            <div className="space-y-2">
              <BiLabel ja="製造番号" en="DJI serial" htmlFor="serialNumber" />
              <Input id="serialNumber" name="serialNumber" className="font-mono" defaultValue={a?.serialNumber} />
            </div>
          </div>
          <div className="space-y-2">
            <BiLabel ja="導入前の飛行時間" en="Hours flown before Hikō" htmlFor="initialHours" />
            <Input id="initialHours" name="initialHours" type="number" step="0.01" min="0" defaultValue={a?.initialHours ?? 0} className="max-w-40 tnum" />
            <p className="text-xs text-muted-foreground">Carried into the running total flight time (⑩) of this aircraft.</p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {a ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await setAircraftArchived(a.id, !a.archived);
                    if (res.success) {
                      toast.success(a.archived ? "Restored" : "Archived");
                      setOpen(false);
                    } else toast.error(res.error);
                  })
                }
              >
                {a.archived ? "Restore" : "Archive"}
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

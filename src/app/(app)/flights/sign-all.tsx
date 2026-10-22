"use client";

import { PenLine } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { signAllMine } from "@/app/actions/flights";
import { Button } from "@/components/ui/button";

export function SignAllButton({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await signAllMine();
          if (!res.success) return void toast.error(res.error);
          const n = res.data?.count ?? 0;
          if (n < count) toast.warning(`Signed ${n} of ${count} — fill in ④ purpose on the others first`);
          else toast.success(`Signed ${n} flight${n === 1 ? "" : "s"}`);
        })
      }
    >
      <PenLine /> Sign my {count} unsigned
    </Button>
  );
}

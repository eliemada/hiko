"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { reprocessFlight } from "@/app/actions/flights";
import { Button } from "@/components/ui/button";

export function ReprocessButton({ flightId, variant = "outline" }: { flightId: string; variant?: "outline" | "default" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await reprocessFlight(flightId);
          if (!res.success) return void toast.error(res.error);
          toast.success("Re-processed from the original log");
          router.replace(`/flights/${res.data?.id}`);
          router.refresh();
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : ""} /> {pending ? "Decrypting…" : "Re-process from original log"}
    </Button>
  );
}

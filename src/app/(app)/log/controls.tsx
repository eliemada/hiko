"use client";

import { Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AircraftPicker({ value, options }: { value: string; options: { id: string; name: string }[] }) {
  const router = useRouter();
  return (
    <Select value={value} onValueChange={(id) => router.push(`/log?aircraft=${id}`)}>
      <SelectTrigger className="h-11 w-full md:h-9 md:w-60" aria-label="Aircraft">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PrintButton() {
  return (
    <Button variant="outline" className="h-11 md:h-9" onClick={() => window.print()}>
      <Printer /> Print
    </Button>
  );
}

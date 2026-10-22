"use client";

import { Eraser, Save } from "lucide-react";
import SignaturePad from "signature_pad";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSignature } from "@/app/actions/fleet";
import { Button } from "@/components/ui/button";

/** Crop transparent margins so the signature fills the small log cells. */
function trimmedPng(source: HTMLCanvasElement, margin = 8): string {
  const ctx = source.getContext("2d");
  if (!ctx) return source.toDataURL("image/png");
  const { width, height } = source;
  const data = ctx.getImageData(0, 0, width, height).data;
  let [minX, minY, maxX, maxY] = [width, height, -1, -1];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return source.toDataURL("image/png");
  const x = Math.max(0, minX - margin);
  const y = Math.max(0, minY - margin);
  const w = Math.min(width, maxX + margin) - x;
  const h = Math.min(height, maxY + margin) - y;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")?.drawImage(source, x, y, w, h, 0, 0, w, h);
  return out.toDataURL("image/png");
}

/** Show a saved (cropped) signature at its natural aspect ratio, centred on the pad. */
function drawCentered(pad: SignaturePad, dataUrl: string, w: number, h: number, ratio: number) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min((w * 0.85) / img.naturalWidth, (h * 0.7) / img.naturalHeight, 1 / ratio);
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    void pad.fromDataURL(dataUrl, { ratio, width, height, xOffset: (w - width) / 2, yOffset: (h - height) / 2 });
  };
  img.src = dataUrl;
}

export function SignatureEditor({ initial }: { initial: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef<SignaturePad | null>(null);
  const [empty, setEmpty] = useState(!initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const instance = new SignaturePad(el, { penColor: "#0b1220", minWidth: 0.8, maxWidth: 2.6 });
    pad.current = instance;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = instance.toData();
      el.width = el.offsetWidth * ratio;
      el.height = el.offsetHeight * ratio;
      el.getContext("2d")?.scale(ratio, ratio);
      instance.clear();
      if (data.length) instance.fromData(data);
      else if (initial) drawCentered(instance, initial, el.offsetWidth, el.offsetHeight, ratio);
    };
    resize();
    window.addEventListener("resize", resize);
    instance.addEventListener("endStroke", () => setEmpty(instance.isEmpty()));
    return () => {
      window.removeEventListener("resize", resize);
      instance.off();
    };
  }, [initial]);

  const save = () =>
    start(async () => {
      const dataUrl = pad.current && !pad.current.isEmpty() && canvas.current ? trimmedPng(canvas.current) : null;
      const res = await saveSignature(dataUrl);
      if (res.success) toast.success(dataUrl ? "Signature saved" : "Signature removed");
      else toast.error(res.error);
    });

  return (
    <div className="space-y-3">
      <div className="relative h-44 overflow-hidden rounded-lg border bg-white">
        <canvas ref={canvas} className="size-full touch-none" aria-label="Signature pad" />
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-slate-300" />
        {empty && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-slate-400">
            Sign here
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            pad.current?.clear();
            setEmpty(true);
          }}
        >
          <Eraser /> Clear
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          <Save /> {pending ? "Saving…" : "Save signature"}
        </Button>
      </div>
    </div>
  );
}

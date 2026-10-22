"use client";

import { CheckCircle2, CircleAlert, Copy, FileText, Loader2, RotateCw, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatDurationLong, formatLogDate, formatLogTime } from "@/lib/flight/format";
import type { IngestResult } from "@/lib/server/ingest";
import { cn } from "@/lib/utils";

type Job =
  | { id: string; file: File; stage: "queued" }
  | { id: string; file: File; stage: "uploading"; progress: number }
  | { id: string; file: File; stage: "processing" }
  | { id: string; file: File; stage: "done"; result: IngestResult }
  | { id: string; file: File; stage: "error"; error: string };

const CONCURRENCY = 2;
const ACCEPT = ".txt";

interface ApiResponse {
  success: boolean;
  data?: IngestResult;
  error?: string;
}

function upload(file: File, onProgress: (pct: number) => void, onUploaded: () => void): Promise<ApiResponse> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/import");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = onUploaded;
    xhr.onload = () => resolve((xhr.response as ApiResponse) ?? { success: false, error: `HTTP ${xhr.status}` });
    xhr.onerror = () => resolve({ success: false, error: "Network error — check your connection" });
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}

export function Importer() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(0);
  const started = useRef(new Set<string>());

  const patch = useCallback((id: string, next: Partial<Job> & { stage: Job["stage"] }) => {
    setJobs((all) => all.map((j) => (j.id === id ? ({ ...j, ...next } as Job) : j)));
  }, []);

  const run = useCallback(
    async (job: Job) => {
      if (started.current.has(job.id)) return;
      started.current.add(job.id);
      running.current += 1;
      patch(job.id, { stage: "uploading", progress: 0 });
      const res = await upload(
        job.file,
        (progress) => patch(job.id, { stage: "uploading", progress }),
        () => patch(job.id, { stage: "processing" }),
      );
      if (res.success && res.data) patch(job.id, { stage: "done", result: res.data });
      else patch(job.id, { stage: "error", error: res.error ?? "Import failed" });
      running.current -= 1;
      started.current.delete(job.id);
    },
    [patch],
  );

  // Simple scheduler: start queued jobs while slots are free.
  useEffect(() => {
    const free = CONCURRENCY - running.current;
    jobs
      .filter((j) => j.stage === "queued")
      .slice(0, Math.max(0, free))
      .forEach((j) => void run(j));
    if (jobs.length > 0 && jobs.every((j) => j.stage === "done" || j.stage === "error")) router.refresh();
  }, [jobs, run, router]);

  const add = (files: FileList | File[]) => {
    const fresh = [...files]
      .filter((f) => f.name.toLowerCase().endsWith(".txt"))
      .map((file): Job => ({ id: crypto.randomUUID(), file, stage: "queued" }));
    setJobs((all) => [...fresh, ...all]);
  };

  const done = jobs.filter((j) => j.stage === "done");
  const imported = done.reduce((n, j) => n + (j.stage === "done" && j.result.status === "imported" ? j.result.flights.length : 0), 0);

  return (
    <div className="space-y-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop DJI flight records here or press Enter to choose files"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "group relative grid min-h-44 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed bg-card px-6 py-8 text-center transition-all duration-150 ease-instrument outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-accent md:min-h-64 md:py-12",
          dragging ? "scale-[1.01] border-primary bg-accent" : "hover:border-primary/60 hover:bg-accent/40",
        )}
      >
        <div className="relative space-y-3">
          <div
            className={cn(
              "mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform duration-200 ease-instrument",
              dragging && "-translate-y-1 scale-110",
            )}
          >
            <Upload className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-base font-semibold">
              <span className="md:hidden">Choose flight records</span>
              <span className="hidden md:inline">Drop your DJI flight records</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <code className="font-mono">FlightRecord_*.txt</code> files from DJI Fly
              <span className="hidden md:inline"> — or click to choose</span>. Batches welcome.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="pointer-events-none hidden md:inline-flex">
            Choose files
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {jobs.length > 0 && (
        <section aria-live="polite" className="overflow-hidden rounded-[10px] border bg-card">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <div className="text-sm font-medium">
              {jobs.length} file{jobs.length > 1 ? "s" : ""}
              {imported > 0 && <span className="text-muted-foreground"> · {imported} flight{imported > 1 ? "s" : ""} imported</span>}
            </div>
            <div className="flex gap-2">
              {imported > 0 && (
                <Button asChild size="sm">
                  <Link href="/flights?unsigned=1">Review & sign</Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setJobs((all) => all.filter((j) => j.stage !== "done" && j.stage !== "error"))}
              >
                Clear finished
              </Button>
            </div>
          </header>
          <ul className="divide-y">
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                onRetry={() => patch(job.id, { stage: "queued" })}
                onRemove={() => setJobs((all) => all.filter((j) => j.id !== job.id))}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function JobRow({ job, onRetry, onRemove }: { job: Job; onRetry: () => void; onRemove: () => void }) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 text-sm">
      <StageIcon job={job} />
      <div className="min-w-0 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-medium">{job.file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tnum">{(job.file.size / 1024 / 1024).toFixed(1)} MB</span>
        </div>
        <StageDetail job={job} />
      </div>
      <div className="flex items-center gap-1">
        {job.stage === "error" && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCw /> Retry
          </Button>
        )}
        {(job.stage === "done" || job.stage === "error" || job.stage === "queued") && (
          <Button size="icon" variant="ghost" className="size-8" onClick={onRemove} aria-label="Remove">
            <X />
          </Button>
        )}
      </div>
    </li>
  );
}

function StageIcon({ job }: { job: Job }) {
  const base = "size-5 shrink-0";
  switch (job.stage) {
    case "queued":
      return <FileText className={cn(base, "text-muted-foreground")} aria-hidden />;
    case "uploading":
    case "processing":
      return <Loader2 className={cn(base, "animate-spin text-primary")} aria-hidden />;
    case "error":
      return <CircleAlert className={cn(base, "text-destructive")} aria-hidden />;
    case "done":
      return job.result.status === "imported" ? (
        <CheckCircle2 className={cn(base, "text-success")} aria-hidden />
      ) : job.result.status === "duplicate" ? (
        <Copy className={cn(base, "text-muted-foreground")} aria-hidden />
      ) : (
        <CircleAlert className={cn(base, "text-warning")} aria-hidden />
      );
  }
}

function StageDetail({ job }: { job: Job }) {
  switch (job.stage) {
    case "queued":
      return <p className="text-xs text-muted-foreground">Queued</p>;
    case "uploading":
      return (
        <div className="flex items-center gap-2">
          <Progress value={job.progress} className="h-1.5 max-w-60" />
          <span className="text-xs text-muted-foreground tnum">Uploading {job.progress}%</span>
        </div>
      );
    case "processing":
      return <p className="text-xs text-muted-foreground">Decrypting · parsing · geocoding · weather…</p>;
    case "error":
      return <p className="text-xs text-destructive">{job.error}</p>;
    case "done": {
      const r = job.result;
      if (r.status === "empty") return <p className="text-xs text-warning">{r.message}</p>;
      return (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {r.status === "duplicate" ? "Already imported" : `${r.aircraftName} · ${r.flights.length} flight${r.flights.length > 1 ? "s" : ""}`}
            {r.status === "imported" && r.estimated && (
              <span className="ml-1 text-warning">· times estimated (no DJI API key)</span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {r.flights.map((f) => (
              <Link
                key={f.id}
                href={`/flights/${f.id}`}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs transition-colors hover:border-primary hover:text-primary tnum"
              >
                {formatLogDate(f.takeoffAt, f.timeZone)} {formatLogTime(f.takeoffAt, f.timeZone)}
                <span className="text-muted-foreground">· {formatDurationLong(f.durationSec)}</span>
                {f.takeoffPlace && <span className="max-w-40 truncate text-muted-foreground">· {f.takeoffPlace}</span>}
              </Link>
            ))}
          </div>
        </div>
      );
    }
  }
}

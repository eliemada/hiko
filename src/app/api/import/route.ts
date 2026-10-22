import { NextResponse } from "next/server";
import { LogDecodeError } from "@/lib/dji/decode";
import { ingestLog, MAX_LOG_BYTES } from "@/lib/server/ingest";
import { getCurrentUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 120;

/** One DJI log per request, so the UI can show per-file progress. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });

  let file: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("file");
    file = entry instanceof File ? entry : null;
  } catch {
    return NextResponse.json({ success: false, error: "Expected multipart form data" }, { status: 400 });
  }
  if (!file) return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_LOG_BYTES) {
    return NextResponse.json({ success: false, error: "File is empty or larger than 40 MB" }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await ingestLog({ bytes, fileName: file.name.slice(0, 200), pilotId: user.id });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof LogDecodeError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 422 });
    }
    console.error("[import] failed", { file: file.name, error });
    return NextResponse.json({ success: false, error: "Import failed — see server logs" }, { status: 500 });
  }
}

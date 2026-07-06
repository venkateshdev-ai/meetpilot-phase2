import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, createMeetingUpload, updateMeetingUpload, saveAiGeneratedSummary, createActionItemsFromAi } from "@/lib/db/store";
import { extractText, SUPPORTED_EXTENSIONS } from "@/lib/ai/extractText";
import { summarizeMeetingText } from "@/lib/ai/summarize";

export const runtime = "nodejs"; // needed for Buffer + pdf-parse/mammoth (not Edge-safe)

// Upload a transcript/notes file for a meeting -> extract text -> Groq LLM
// summary + action items -> write real MeetingSummary + ActionItem rows.
// This is the "upload a file, get a summary + action items" flow requested
// as an alternative to live audio transcription (which needs a separate
// Whisper/AssemblyAI/Deepgram integration this build doesn't have).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided (expected multipart field 'file')" }, { status: 400 });
  }

  const lower = file.name.toLowerCase();
  if (!SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return NextResponse.json(
      { error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}` },
      { status: 400 }
    );
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const upload = await createMeetingUpload({
    meetingId: params.id,
    uploadedById: me.id,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });

  try {
    await updateMeetingUpload(upload.id, { status: "PROCESSING" });

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractText(buffer, file.type, file.name);

    if (!text.trim()) {
      await updateMeetingUpload(upload.id, { status: "FAILED", errorMessage: "No extractable text in file" });
      return NextResponse.json({ error: "No extractable text found in file" }, { status: 422 });
    }

    const ai = await summarizeMeetingText(text);
    if (!ai.ok) {
      await updateMeetingUpload(upload.id, {
        status: "FAILED",
        errorMessage: ai.error,
        extractedText: text.slice(0, 50000),
      });
      return NextResponse.json({ error: ai.error ?? "Summarization failed" }, { status: 502 });
    }

    const [summary, actionItems] = await Promise.all([
      saveAiGeneratedSummary(params.id, {
        executiveSummary: ai.executiveSummary,
        keyDecisions: ai.keyDecisions,
        topics: ai.topics,
      }),
      createActionItemsFromAi(params.id, ai.actionItems ?? []),
    ]);

    await updateMeetingUpload(upload.id, {
      status: "DONE",
      extractedText: text.slice(0, 50000),
      processedAt: new Date().toISOString(),
    });

    return NextResponse.json({ uploadId: upload.id, summary, actionItemsCreated: actionItems.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateMeetingUpload(upload.id, { status: "FAILED", errorMessage: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

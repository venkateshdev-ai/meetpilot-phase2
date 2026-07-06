import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findUserByEmail, createMeetingUpload, updateMeetingUpload, saveAiGeneratedSummary, createActionItemsFromAi } from "@/lib/db/store";
import { extractText, isAudioVideoFile, SUPPORTED_EXTENSIONS } from "@/lib/ai/extractText";
import { summarizeMeetingText } from "@/lib/ai/summarize";
import { transcribeAudio } from "@/lib/ai/groq";

export const runtime = "nodejs"; // needed for Buffer + pdf-parse/mammoth (not Edge-safe)

const MAX_TEXT_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_AV_FILE_BYTES = 25 * 1024 * 1024; // Groq Whisper's free-tier request limit

// Upload a meeting recording (audio/video) or a transcript/notes file ->
// extract text (transcribing AV via Groq Whisper first) -> Groq LLM summary
// + action items -> write real MeetingSummary + ActionItem rows.
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
  const isAv = isAudioVideoFile(file.name);
  const maxBytes = isAv ? MAX_AV_FILE_BYTES : MAX_TEXT_FILE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `File too large (max ${maxBytes / (1024 * 1024)}MB)` }, { status: 400 });
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

    let text: string;
    if (isAv) {
      const transcription = await transcribeAudio(buffer, file.name, file.type || "application/octet-stream");
      if (!transcription.ok) {
        await updateMeetingUpload(upload.id, { status: "FAILED", errorMessage: transcription.error });
        return NextResponse.json({ error: transcription.error ?? "Transcription failed" }, { status: 502 });
      }
      text = transcription.text ?? "";
    } else {
      text = await extractText(buffer, file.type, file.name);
    }

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

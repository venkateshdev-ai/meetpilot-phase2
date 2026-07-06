// Pulls plain text out of an uploaded file so it can be handed to the LLM.
// Supports .txt/.md (read as-is), .docx (via mammoth), and .pdf (via
// pdf-parse). Anything else is rejected at the API route before this runs.
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export async function extractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Plain text / markdown / anything else — decode as UTF-8 text.
  return buffer.toString("utf-8");
}

export const SUPPORTED_TEXT_EXTENSIONS = [".txt", ".md", ".docx", ".pdf"];

// Formats Groq's hosted Whisper transcription endpoint accepts directly —
// audio is extracted from the video containers (mp4/webm) server-side by
// Groq, no local ffmpeg step needed here.
export const SUPPORTED_AV_EXTENSIONS = [".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".flac"];

export const SUPPORTED_EXTENSIONS = [...SUPPORTED_TEXT_EXTENSIONS, ...SUPPORTED_AV_EXTENSIONS];

export function isAudioVideoFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return SUPPORTED_AV_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

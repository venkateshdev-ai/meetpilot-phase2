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

export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx", ".pdf"];

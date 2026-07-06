import { callLLM } from "./groq";

export interface SummarizeResult {
  ok: boolean;
  error?: string;
  executiveSummary?: string;
  keyDecisions?: string[];
  topics?: { topic: string; weight: number }[];
  actionItems?: { description: string; assigneeName?: string; dueDate?: string }[];
}

const SYSTEM_PROMPT = `You are MeetPilot's meeting-notes analyst. You will be given the raw text of an
uploaded meeting transcript or notes document. Produce a JSON object with exactly these keys:

{
  "executiveSummary": "2-4 sentence summary of what the meeting covered and decided",
  "keyDecisions": ["short decision 1", "short decision 2"],
  "topics": [{"topic": "short topic name", "weight": 1-10}],
  "actionItems": [{"description": "clear, single-sentence actionable task", "assigneeName": "name mentioned in text, or omit if unclear", "dueDate": "YYYY-MM-DD if a date is mentioned, else omit"}]
}

Rules: only use information present in the text — never invent names, dates, or decisions. If the text is
too short or unclear to extract something, return an empty array for that field. Respond with ONLY the JSON
object, no markdown fences, no commentary.`;

export async function summarizeMeetingText(text: string): Promise<SummarizeResult> {
  // Keep prompts within a safe context window for the free tier — truncate
  // very long uploads rather than failing outright.
  const trimmed = text.length > 24000 ? text.slice(0, 24000) : text;

  const result = await callLLM([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: trimmed },
  ]);

  if (!result.ok || !result.content) {
    return { ok: false, error: result.error ?? "No response from model" };
  }

  try {
    const parsed = JSON.parse(result.content);
    return {
      ok: true,
      executiveSummary: parsed.executiveSummary ?? "",
      keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    };
  } catch {
    return { ok: false, error: "Model response wasn't valid JSON" };
  }
}

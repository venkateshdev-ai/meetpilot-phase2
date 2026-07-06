// Minimal LLM client — raw fetch against any OpenAI-compatible chat
// completions endpoint, no SDK (same pattern as src/lib/db/supabase.ts and
// src/lib/email/resend.ts). Works with Groq (free tier, the default),
// OpenAI, Ollama (http://localhost:11434/v1), LM Studio, vLLM, Together —
// anything that speaks the OpenAI API shape.
//
// Config resolution: the AI tile in Settings (Integration table, provider
// key "GROQ" for backward compat) wins; .env vars are the fallback for a
// single-operator/demo deployment. baseUrl + model + apiKey are all
// user-configurable, so switching providers is a Settings change, not a
// code change. Local providers like Ollama ignore the Authorization header,
// so any placeholder key works for them.

const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

export interface LlmResult {
  ok: boolean;
  content?: string;
  error?: string;
}

interface LlmConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

async function resolveLlmConfig(): Promise<LlmConfig> {
  const { getOrgIntegration } = await import("@/lib/db/store");
  const stored = await getOrgIntegration("GROQ").catch(() => undefined);
  return {
    baseUrl: (stored?.config?.baseUrl || process.env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    apiKey: stored?.accessTokenEnc || process.env.GROQ_API_KEY,
    model: stored?.config?.model || process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  };
}

const NO_KEY_ERROR =
  "No AI provider configured — add a base URL + API key under Settings > AI / LLM (or set GROQ_API_KEY in .env)";

export async function callLLM(messages: { role: "system" | "user"; content: string }[]): Promise<LlmResult> {
  const { baseUrl, apiKey, model } = await resolveLlmConfig();

  if (!apiKey) {
    return { ok: false, error: NO_KEY_ERROR };
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `LLM (${baseUrl}) ${res.status}: ${body}` };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "LLM returned no content" };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface TranscriptionResult {
  ok: boolean;
  text?: string;
  error?: string;
}

// Turns an uploaded meeting recording into text via the provider's
// OpenAI-compatible /audio/transcriptions endpoint (Whisper on Groq/OpenAI).
// Note: pure text-only providers (e.g. a stock Ollama server) don't expose
// this endpoint — text-file uploads still work there, only audio/video
// transcription needs a Whisper-capable provider.
export async function transcribeAudio(buffer: Buffer, fileName: string, mimeType: string): Promise<TranscriptionResult> {
  const { baseUrl, apiKey } = await resolveLlmConfig();
  if (!apiKey) {
    return { ok: false, error: NO_KEY_ERROR };
  }

  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
    form.append("model", "whisper-large-v3");
    form.append("response_format", "text");

    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Transcription (${baseUrl}) ${res.status}: ${body}` };
    }

    const text = await res.text();
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

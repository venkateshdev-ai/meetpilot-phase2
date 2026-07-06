// Minimal Groq client — raw fetch against Groq's OpenAI-compatible chat
// completions endpoint, no SDK (same pattern as src/lib/db/supabase.ts and
// src/lib/email/resend.ts). Groq's free tier is what makes "AI summary from
// an uploaded file" work without a paid key.
//
// Why not Ollama: Ollama is completely free but runs as a local process on
// whatever machine is executing this code — fine when you run `npm run dev`
// on your own laptop with Ollama installed, but breaks the moment this app
// is deployed anywhere else (Vercel, a server) unless you also host an
// Ollama instance there. Groq's hosted free tier works in both places with
// zero extra infra, which is why it's the default here. If you do want
// Ollama for fully local/offline use, swap callLLM's fetch target to
// `http://localhost:11434/api/chat` and adjust the request/response shape —
// the rest of summarize.ts (prompt + parsing) doesn't need to change.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

export interface LlmResult {
  ok: boolean;
  content?: string;
  error?: string;
}

export async function callLLM(messages: { role: "system" | "user"; content: string }[]): Promise<LlmResult> {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

  if (!apiKey) {
    return { ok: false, error: "GROQ_API_KEY not configured in .env" };
  }

  try {
    const res = await fetch(GROQ_API_URL, {
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
      return { ok: false, error: `Groq ${res.status}: ${body}` };
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, error: "Groq returned no content" };
    return { ok: true, content };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

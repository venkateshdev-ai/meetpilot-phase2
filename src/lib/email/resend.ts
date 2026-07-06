// Minimal Resend REST client — raw fetch, no SDK, same pattern as
// src/lib/db/supabase.ts. Requires RESEND_API_KEY + EMAIL_FROM env vars.
//
// EMAIL_FROM must be an address on a domain you've verified in Resend (or,
// for testing before you verify a domain, Resend lets you send from
// "onboarding@resend.dev" to your own account's email only).
//
// Every call result gets logged to the EmailLog table by the caller (see
// src/lib/db/store.ts:logEmail) so "did this email actually send" is always
// answerable from the DB, not just server logs.

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailResult {
  ok: boolean;
  error?: string;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY or EMAIL_FROM not configured in .env" };
  }

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

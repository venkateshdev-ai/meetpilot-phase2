import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import IntegrationsPanel from "./IntegrationsPanel";

// Settings: AI/LLM + PM-tool credentials and the audit trail. User management
// lives on its own page now (/users).
export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-400">API keys and integrations.</p>
      </div>

      <section id="settings">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          API keys & integrations
        </h2>
        <p className="mb-3 -mt-2 text-xs text-slate-500">
          Bring your own AI: any OpenAI-compatible LLM (Groq, OpenAI, Ollama, LM Studio, vLLM…) powers meeting
          summaries and transcription. PM-tool connections enable real ticket push + live ticket listing.
        </p>
        <IntegrationsPanel />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Audit log</h2>
        <Card className="text-sm text-slate-400">
          Varan connected Linear · Hulk updated Batman's role to Admin · Varan created "Sprint Sync"
        </Card>
      </section>
    </div>
  );
}

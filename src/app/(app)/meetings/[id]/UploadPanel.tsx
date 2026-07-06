"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, Loader2 } from "lucide-react";
import { Card, Button } from "@/components/ui";

// Upload a transcript/notes file -> POST /api/meetings/[id]/upload -> Groq
// generates a summary, key decisions, topics, and action items from it, all
// written as real rows (MeetingSummary + ActionItem). On success we
// router.refresh() so the Summary/Action Items/Analysis tabs (server-fetched)
// immediately show the new data without a full page reload.
export default function UploadPanel({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/meetings/${meetingId}/upload`, { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setResult({ ok: false, message: body.error ?? "Upload failed" });
    } else {
      setResult({
        ok: true,
        message: `Summary generated and ${body.actionItemsCreated} action item(s) created from "${file.name}".`,
      });
      router.refresh();
    }
    setUploading(false);
  }

  return (
    <Card>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-base-700 p-8 text-center">
        <UploadCloud size={28} className="text-slate-500" />
        <div>
          <p className="text-sm font-medium">Upload a recording, transcript, or notes file</p>
          <p className="mt-1 text-xs text-slate-500">
            Audio/video (.mp3, .wav, .m4a, .mp4, .webm — max 25MB) or text (.txt, .md, .docx, .pdf — max 10MB)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.docx,.pdf,.mp3,.wav,.m4a,.mp4,.webm,.mpeg,.mpga,.ogg,.flac"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
          <span className="flex items-center gap-1.5">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {uploading ? "Generating summary…" : "Choose file"}
          </span>
        </Button>
      </div>
      {result && (
        <p className={`mt-3 text-xs ${result.ok ? "text-emerald-400" : "text-danger"}`}>{result.message}</p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Audio/video is transcribed first (Groq Whisper), then the text runs through an LLM (Groq) to produce the
        executive summary, key decisions, topics, and action items you'll see in the Summary / Action Items /
        Analysis tabs. Needs a Groq API key — add yours in Admin &gt; Settings, or set GROQ_API_KEY in .env.
      </p>
    </Card>
  );
}

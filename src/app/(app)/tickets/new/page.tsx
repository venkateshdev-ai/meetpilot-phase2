import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listGtmSystems } from "@/lib/db/store";
import NewRequestForm from "./NewRequestForm";

export default async function NewRequestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const systems = await listGtmSystems();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">File a request</h1>
      <p className="mb-5 text-sm text-slate-400">
        Classify it now so it lands in the right place in the queue — a triage owner can adjust any of
        it later.
      </p>
      <NewRequestForm systems={systems} />
    </div>
  );
}

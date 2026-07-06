import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getTicketById } from "@/lib/db/store";
import TicketDetailView from "./TicketDetailView";

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const ticket = await getTicketById(params.id);
  if (!ticket) notFound();

  return <TicketDetailView ticket={ticket} />;
}

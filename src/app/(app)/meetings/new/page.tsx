import { listUsers } from "@/lib/db/store";
import CreateMeetingForm from "./CreateMeetingForm";

export default async function CreateMeetingPage() {
  const users = await listUsers();
  return <CreateMeetingForm users={users} />;
}

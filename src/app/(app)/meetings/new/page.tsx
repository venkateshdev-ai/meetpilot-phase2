import { listUsers, listRooms } from "@/lib/db/store";
import CreateMeetingForm from "./CreateMeetingForm";

export default async function CreateMeetingPage() {
  const [users, rooms] = await Promise.all([listUsers(), listRooms()]);
  return <CreateMeetingForm users={users} rooms={rooms} />;
}

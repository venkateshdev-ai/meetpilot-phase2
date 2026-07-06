import { orgWideAnalytics } from "@/lib/db/store";
import { roomUtilization, deskUtilizationByFloor } from "@/lib/mock/store";
import AnalyticsView from "./AnalyticsView";

// Meetings/action-items/topics rollup is real (src/lib/db/store.ts). Room and
// desk utilization stay on the mock layer for now — see note in AnalyticsView.
export default async function AnalyticsPage() {
  const stats = await orgWideAnalytics();
  const rooms = roomUtilization();
  const deskFloors = deskUtilizationByFloor();

  return <AnalyticsView stats={stats} rooms={rooms} deskFloors={deskFloors} />;
}

import { orgWideAnalytics } from "@/lib/db/store";
import AnalyticsView from "./AnalyticsView";

// Meetings/action-items/topics rollup, all live from the real database.
export default async function AnalyticsPage() {
  const stats = await orgWideAnalytics();
  return <AnalyticsView stats={stats} />;
}

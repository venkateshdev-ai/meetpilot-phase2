import { orgWideAnalytics } from "@/lib/db/store";
import AnalyticsView from "./AnalyticsView";
import { getCaller } from "@/lib/authz";
import { can } from "@/lib/rbac";
import { Card } from "@/components/ui";

// Meetings/action-items/topics rollup, all live from the real database.
export default async function AnalyticsPage() {
  const caller = await getCaller();
  if (!caller || !can(caller.role, "analytics:view_org_wide")) {
    return (
      <Card className="mx-auto max-w-md text-center text-sm text-slate-400">
        Your role doesn&apos;t have access to org-wide analytics.
      </Card>
    );
  }
  const stats = await orgWideAnalytics();
  return <AnalyticsView stats={stats} />;
}

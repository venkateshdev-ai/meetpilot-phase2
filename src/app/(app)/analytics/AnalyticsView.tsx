"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui";

export interface AnalyticsData {
  stats: {
    totalMeetings: number;
    completedMeetings: number;
    avgRoi: number;
    statusCounts: Record<string, number>;
    topics: { topic: string; weight: number }[];
  };
}

export default function AnalyticsView({ stats }: AnalyticsData) {
  const statusData = Object.entries(stats.statusCounts).map(([status, count]) => ({ status, count }));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Analytics</h1>
      <p className="mb-6 text-sm text-slate-400">
        Org-wide rollup across all meetings and action items — live from the database.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="text-center">
          <div className="text-2xl font-bold text-accent-400">{stats.totalMeetings}</div>
          <div className="text-xs text-slate-500">Total meetings</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-accent-400">{stats.completedMeetings}</div>
          <div className="text-xs text-slate-500">Completed</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-accent-400">{stats.avgRoi}%</div>
          <div className="text-xs text-slate-500">Avg. meeting ROI</div>
        </Card>
        <Card className="text-center">
          <div className="text-2xl font-bold text-accent-400">{stats.statusCounts.DONE ?? 0}</div>
          <div className="text-xs text-slate-500">Action items done</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h4 className="mb-3 text-sm font-semibold">Task status rollup</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData}>
              <XAxis dataKey="status" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#101627", border: "1px solid #1a2138" }} />
              <Bar dataKey="count" fill="#6d5bf8" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h4 className="mb-3 text-sm font-semibold">Top topics across meetings</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.topics} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="topic" stroke="#64748b" fontSize={11} width={100} />
              <Tooltip contentStyle={{ background: "#101627", border: "1px solid #1a2138" }} />
              <Bar dataKey="weight" fill="#2e5aac" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { BookCheck, Target } from "lucide-react";
import { api, Overview, WeeklyStats } from "../lib/api";
import { WeeklyBarChart } from "../components/WeeklyBarChart";
import { StatTile } from "../components/StatTile";
import { StreakRow } from "../components/StreakRow";
import { Card, Badge } from "../components/ui";

export function StatisticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.overview(), api.weeklyStats()])
      .then(([o, w]) => {
        setOverview(o);
        setWeekly(w);
      })
      .catch((e) => setError(e.message ?? "Could not load statistics."));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-ink">Learning Overview</h1>
        <Badge tone="white">Weekly</Badge>
      </div>

      {error && <div className="mb-4 rounded-card bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {(!overview || !weekly) && !error && (
        <div className="h-64 animate-pulse rounded-card bg-white/60" />
      )}

      {overview && weekly && (
        <>
          <Card className="mb-6 p-5">
            <h2 className="mb-4 text-sm font-bold text-ink">Reviews this week</h2>
            <WeeklyBarChart days={weekly.days} />
          </Card>

          <div className="mb-6 flex gap-3">
            <StatTile icon={<BookCheck size={16} />} label="Reviews today" value={overview.reviews_today} tone="primary" />
            <StatTile icon={<Target size={16} />} label="Mastery" value={`${overview.mastery_pct}%`} tone="blue" />
          </div>

          <StreakRow streak={overview.streak} />
        </>
      )}
    </div>
  );
}

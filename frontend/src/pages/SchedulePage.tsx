import { useEffect, useMemo, useState } from "react";
import { CalendarX2 } from "lucide-react";
import { api, ScheduleOut } from "../lib/api";
import { CalendarWidget } from "../components/CalendarWidget";
import { ScheduleListItem } from "../components/ScheduleListItem";
import { Card } from "../components/ui";

export function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  useEffect(() => {
    api
      .schedule()
      .then(setSchedule)
      .catch((e) => setError(e.message ?? "Could not load your schedule."));
  }, []);

  const studyDays = useMemo(() => new Set(schedule?.study_days ?? []), [schedule]);
  const examDays = useMemo(
    () => new Set((schedule?.exams ?? []).map((e) => e.exam_date)),
    [schedule],
  );

  const todayIso = today.toISOString().slice(0, 10);
  const upcomingExams = useMemo(
    () =>
      (schedule?.exams ?? [])
        .filter((e) => e.exam_date >= todayIso)
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date)),
    [schedule, todayIso],
  );

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-extrabold text-ink">Learning Schedule Plan</h1>

      {error && <div className="mb-4 rounded-card bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {!schedule && !error && <div className="h-72 animate-pulse rounded-card bg-white/60" />}

      {schedule && (
        <>
          <div className="mb-6">
            <CalendarWidget
              year={cursor.year}
              month={cursor.month}
              studyDays={studyDays}
              examDays={examDays}
              onPrevMonth={() => shiftMonth(-1)}
              onNextMonth={() => shiftMonth(1)}
            />
          </div>

          <h2 className="mb-3 text-base font-bold text-ink">Upcoming exams</h2>
          {upcomingExams.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-lav text-primary">
                <CalendarX2 size={24} />
              </div>
              <p className="mb-1 font-bold text-ink">No exams scheduled</p>
              <p className="text-sm text-muted">Set an exam date from any document to see it here.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {upcomingExams.map((e) => (
                <ScheduleListItem
                  key={e.document_id}
                  title={e.title}
                  date={e.exam_date}
                  documentId={e.document_id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

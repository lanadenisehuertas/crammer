import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export interface DayCount {
  date: string;
  reviews: number;
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function TooltipContent({ active, payload }: { active?: boolean; payload?: { value: number }[] }) {
  if (!active || !payload || !payload.length) return null;
  const n = payload[0].value;
  return (
    <div className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-soft">
      {n} review{n === 1 ? "" : "s"}
    </div>
  );
}

export function WeeklyBarChart({ days }: { days: DayCount[] }) {
  const max = Math.max(1, ...days.map((d) => d.reviews));
  const data = days.map((d) => ({
    ...d,
    label: WEEKDAY[new Date(`${d.date}T00:00:00`).getDay()],
    isMax: d.reviews === max && d.reviews > 0,
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B7280", fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip content={<TooltipContent />} cursor={{ fill: "transparent" }} />
          <Bar dataKey="reviews" radius={[8, 8, 8, 8]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.date} fill={d.isMax ? "#8B7CF6" : "#EDE9FB"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

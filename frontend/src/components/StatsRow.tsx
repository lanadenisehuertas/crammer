import { BookOpen, Clock, Layers } from "lucide-react";

function Tile({
  icon,
  value,
  label,
  bg,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  bg: string;
}) {
  return (
    <div className="flex-1 rounded-card bg-white p-4 text-center shadow-soft">
      <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full ${bg}`}>
        {icon}
      </div>
      <p className="text-lg font-extrabold text-ink">{value}</p>
      <p className="text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

export function StatsRow({
  modules,
  cards,
  due,
}: {
  modules: number;
  cards: number;
  due: number;
}) {
  return (
    <div className="flex gap-3">
      <Tile icon={<Layers size={16} className="text-primary" />} value={modules} label="Modules" bg="bg-lav" />
      <Tile icon={<BookOpen size={16} className="text-emerald-700" />} value={cards} label="Cards" bg="bg-mint" />
      <Tile icon={<Clock size={16} className="text-blue" />} value={due} label="Due" bg="bg-blue/10" />
    </div>
  );
}

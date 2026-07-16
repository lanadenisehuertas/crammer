import { NavLink, Outlet } from "react-router-dom";
import { Home, BarChart3, CalendarDays, Plus } from "lucide-react";
import { cn } from "../lib/cn";

const NAV_ITEMS = [
  { to: "/", icon: Home, label: "Home", end: true },
  { to: "/statistics", icon: BarChart3, label: "Stats", end: false },
  { to: "/schedule", icon: CalendarDays, label: "Schedule", end: false },
  { to: "/upload", icon: Plus, label: "Add", end: false },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-wash">
      <div className="mx-auto flex min-h-screen max-w-md flex-col md:max-w-4xl md:flex-row">
        <SidebarNav />
        <main className="flex-1 px-4 pb-28 pt-6 md:pb-10 md:pl-8 md:pt-10">
          <Outlet />
        </main>
        <BottomTabBar />
      </div>
    </div>
  );
}

function SidebarNav() {
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-ink/5 px-4 py-10 md:flex">
      <div className="mb-8 px-2 text-xl font-extrabold tracking-tight text-ink">Crammer</div>
      {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition-colors",
              isActive ? "bg-ink text-white" : "text-muted hover:bg-white hover:text-ink",
            )
          }
        >
          <Icon size={18} strokeWidth={2.4} />
          {label}
        </NavLink>
      ))}
    </aside>
  );
}

function BottomTabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-ink/5 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 rounded-2xl px-4 py-1.5 text-[11px] transition-colors",
                isActive ? "font-bold text-ink" : "font-medium text-muted",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.6 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

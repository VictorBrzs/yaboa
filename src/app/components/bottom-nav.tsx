import { CalendarDays, ClipboardList, MapPin, MessageCircle, UserRound } from "lucide-react";
import type { Tab } from "../types";

const navItems = [
  { id: "map" as const, label: "Mapa", icon: MapPin },
  { id: "events" as const, label: "Festas", icon: CalendarDays },
  { id: "social" as const, label: "Social", icon: MessageCircle },
  { id: "my-parties" as const, label: "Minhas", icon: ClipboardList },
  { id: "profile" as const, label: "Perfil", icon: UserRound },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => onChange(item.id)}>
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

import { IonIcon } from "@ionic/react";
import { calendarOutline, chatbubblesOutline, clipboardOutline, mapOutline, personOutline } from "ionicons/icons";
import type { Tab } from "../types";

const navItems = [
  { id: "map" as const, label: "Mapa", icon: mapOutline },
  { id: "events" as const, label: "Festas", icon: calendarOutline },
  { id: "social" as const, label: "Social", icon: chatbubblesOutline },
  { id: "my-parties" as const, label: "Minhas", icon: clipboardOutline },
  { id: "profile" as const, label: "Perfil", icon: personOutline },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="app-footer" aria-label="Navegação principal">
      <div className="bottom-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "tab-selected" : ""}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => onChange(item.id)}
          >
            <IonIcon icon={item.icon} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

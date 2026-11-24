import { IonFooter, IonIcon, IonLabel, IonTabBar, IonTabButton } from "@ionic/react";
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
    <IonFooter className="app-footer">
      <IonTabBar className="bottom-nav">
        {navItems.map((item) => {
          return (
            <IonTabButton
              key={item.id}
              tab={item.id}
              selected={tab === item.id}
              onClick={() => onChange(item.id)}
            >
              <IonIcon icon={item.icon} />
              <IonLabel>{item.label}</IonLabel>
            </IonTabButton>
          );
        })}
      </IonTabBar>
    </IonFooter>
  );
}

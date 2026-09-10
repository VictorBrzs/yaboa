import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { EmptyState } from "../components/common";
import type { Party } from "../types";
import { PartyCard } from "./map-screen";

type EventsScreenProps = {
  parties: Party[];
  onCreate: () => void;
  onSelect: (id: string) => void;
  readOnly: boolean;
};

export function EventsScreen({ parties, onCreate, onSelect, readOnly }: EventsScreenProps) {
  const [sortMode, setSortMode] = useState<"all" | "near">("all");
  const myParties = parties.filter((party) => party.isOwner);
  const visibleParties = useMemo(() => {
    if (sortMode === "near") return [...parties].sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    return [...parties].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [parties, sortMode]);

  return (
    <section className="screen with-nav">
      <header className="page-header page-header-row">
        <div>
          <p className="eyebrow">Festas</p>
          <h1>Agenda das festas</h1>
        </div>
        {!readOnly && (
          <button className="icon-button" onClick={onCreate} aria-label="Criar festa">
            <Plus size={20} />
          </button>
        )}
      </header>

      <div className="event-dashboard">
        <div>
          <strong>{parties.length}</strong>
          <span>visiveis</span>
        </div>
        <div>
          <strong>{myParties.length}</strong>
          <span>criadas por voce</span>
        </div>
      </div>

      <div className="segmented event-filter">
        <button type="button" className={sortMode === "all" ? "active" : ""} onClick={() => setSortMode("all")}>
          Todas
        </button>
        <button type="button" className={sortMode === "near" ? "active" : ""} onClick={() => setSortMode("near")}>
          Mais proximas
        </button>
      </div>

      {parties.length === 0 ? (
        <EmptyState
          title="Sem festas ainda"
          text={readOnly ? "O modo convidado permite apenas visualizar as festas publicadas." : "Cadastre uma festa para ela aparecer no mapa."}
          action={readOnly ? undefined : "Nova festa"}
          onAction={readOnly ? undefined : onCreate}
        />
      ) : (
        <div className="party-list">
          {visibleParties.map((party) => (
            <PartyCard party={party} key={party.id} onClick={() => onSelect(party.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

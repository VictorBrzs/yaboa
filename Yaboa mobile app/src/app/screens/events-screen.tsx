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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const myParties = parties.filter((party) => party.isOwner);
  const visibleParties = useMemo(() => {
    const filtered = parties.filter((party) => (!dateFrom || party.date >= dateFrom) && (!dateTo || party.date <= dateTo));
    if (sortMode === "near") return [...filtered].sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    return [...filtered].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [parties, sortMode, dateFrom, dateTo]);

  return (
    <section className="screen with-nav">
      <header className="page-header page-header-row">
        <div>
          <p className="eyebrow">Festas</p>
          <h1>Agenda das festas</h1>
        </div>
        {!readOnly && (
          <button type="button" className="icon-button" onClick={onCreate} aria-label="Criar festa">
            <Plus size={20} />
          </button>
        )}
      </header>

      <div className="event-dashboard">
        <div>
          <strong>{visibleParties.length}</strong>
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

      <div className="event-date-filter" aria-label="Filtrar festas por data">
        <label className="field">
          <span>De</span>
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>Até</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        {(dateFrom || dateTo) && (
          <button type="button" className="ghost-button event-date-reset" onClick={() => { setDateFrom(""); setDateTo(""); }}>
            Limpar datas
          </button>
        )}
      </div>

      {parties.length === 0 ? (
        <EmptyState
          title="Sem festas ainda"
          text={readOnly ? "O modo convidado permite apenas visualizar as festas publicadas." : "Cadastre uma festa para ela aparecer no mapa."}
          action={readOnly ? undefined : "Nova festa"}
          onAction={readOnly ? undefined : onCreate}
        />
      ) : visibleParties.length === 0 ? (
        <EmptyState title="Nenhuma festa nesse período" text="Altere as datas ou limpe o filtro para ver outras festas." />
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

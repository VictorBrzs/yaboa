import { CalendarDays, Edit3, MapPin, Trash2, UsersRound } from "lucide-react";
import { EmptyState } from "../components/common";
import { formatDate, initials } from "../helpers";
import type { Party } from "../types";

type MyPartiesScreenProps = {
  parties: Party[];
  onCreate: () => void;
  onEdit: (party: Party) => void;
  onSelect: (id: string) => void;
  onRemoveAttendee: (partyId: string, userId: string) => void;
  readOnly: boolean;
};

export function MyPartiesScreen({ parties, onCreate, onEdit, onSelect, onRemoveAttendee, readOnly }: MyPartiesScreenProps) {
  return (
    <section className="screen with-nav my-parties-screen">
      <header className="page-header page-header-row">
        <div>
          <p className="eyebrow">Minhas festas</p>
          <h1>Controle das festas criadas</h1>
        </div>
      </header>

      {parties.length === 0 ? (
        <EmptyState
          title="Nenhuma festa sua ainda"
          text={readOnly ? "A conta de convidado não cria nem gerencia festas." : "Crie uma festa para gerenciar confirmados, detalhes e edição."}
          action={readOnly ? undefined : "Criar festa"}
          onAction={readOnly ? undefined : onCreate}
        />
      ) : (
        <div className="owner-party-list">
          {parties.map((party) => (
            <article className="owner-party-card" key={party.id}>
              <button className="owner-party-main" onClick={() => onSelect(party.id)}>
                <img src={party.imageUrl} alt="" />
                <div>
                  <span className="vibe-pill">{party.visibility === "friends" ? "Amigos" : "Publica"}</span>
                  <h2>{party.title}</h2>
                  <p>
                    <MapPin size={14} /> {party.venueName}
                  </p>
                  <p>
                    <CalendarDays size={14} /> {formatDate(party.date)} as {party.time}
                  </p>
                  <p>
                    <UsersRound size={14} /> {party.attendees.length} confirmados
                  </p>
                </div>
              </button>

              <div className="owner-actions">
                {!readOnly && (
                  <button onClick={() => onEdit(party)}>
                    <Edit3 size={16} /> Editar
                  </button>
                )}
                <button onClick={() => onSelect(party.id)}>Detalhes</button>
              </div>

              <div className="attendee-panel">
                <div className="section-title compact-title">
                  <h2>Usuarios cadastrados</h2>
                  <span>{party.attendees.length}</span>
                </div>
                {party.attendees.length === 0 ? (
                  <p className="muted-block">Nenhum usuario confirmou presenca ainda.</p>
                ) : (
                  <div className="attendee-list">
                    {party.attendees.map((attendee) => (
                      <article className="attendee-row" key={attendee.id}>
                        {attendee.avatarUrl ? <img src={attendee.avatarUrl} alt={attendee.name} /> : <span>{initials(attendee.name)}</span>}
                        <div>
                          <strong>{attendee.name}</strong>
                          <small>@{attendee.username || "usuario"}</small>
                        </div>
                        {!readOnly && (
                          <button onClick={() => onRemoveAttendee(party.id, attendee.id)} aria-label={`Remover ${attendee.name} da festa`}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

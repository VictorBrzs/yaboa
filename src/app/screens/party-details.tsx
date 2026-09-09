import { CalendarDays, Check, ChevronLeft, Edit3, MapPin, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { formatDate } from "../helpers";
import type { Party } from "../types";
import { InfoLine } from "../components/common";

type PartyDetailsProps = {
  party: Party;
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCheckIn: () => void;
};

export function PartyDetails({ party, busy, onBack, onEdit, onDelete, onCheckIn }: PartyDetailsProps) {
  return (
    <section className="details-screen">
      <div className="details-hero" style={{ backgroundImage: `url(${party.imageUrl})` }}>
        <button className="floating-button left" onClick={onBack} aria-label="Voltar">
          <ChevronLeft size={22} />
        </button>
        <div className="details-overlay">
          <span className="vibe-pill">{party.vibe}</span>
          <h1>{party.title}</h1>
          <p>{party.venueName}</p>
        </div>
      </div>

      <div className="details-content">
        <div className="action-row">
          <button className="primary-button compact" onClick={onCheckIn} disabled={busy || party.isGoing}>
            <Check size={18} /> {party.isGoing ? "Presenca salva" : "Confirmar presenca"}
          </button>
          {party.isOwner && (
            <button className="icon-button" onClick={onEdit} aria-label="Editar festa">
              <Edit3 size={19} />
            </button>
          )}
          {party.isOwner && (
            <button className="icon-button danger" onClick={onDelete} aria-label="Excluir festa">
              <Trash2 size={19} />
            </button>
          )}
        </div>
        <InfoLine icon={<CalendarDays size={18} />} label={`${formatDate(party.date)} as ${party.time}`} />
        <InfoLine icon={<MapPin size={18} />} label={`${party.address} - ${party.distanceKm?.toFixed(1) ?? "?"} km`} />
        <InfoLine
          icon={<UsersRound size={18} />}
          label={`${party.going} pessoas confirmadas - ${party.visibility === "friends" ? "somente amigos" : "publica"}`}
        />
        {party.isOwner && <InfoLine icon={<ShieldCheck size={18} />} label="Voce e o criador. Edicao liberada." />}
        {party.friendsGoing.length > 0 && <p className="friend-note">Amigos indo: {party.friendsGoing.slice(0, 4).join(", ")}</p>}
        <p className="description">{party.description || "Sem descricao por enquanto."}</p>
        <div className="tag-row">
          {party.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

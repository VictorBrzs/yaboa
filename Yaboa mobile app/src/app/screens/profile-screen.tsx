import { FormEvent, useEffect, useState } from "react";
import { AtSign, Camera, Edit3, RefreshCw, Save, UserRound, X } from "lucide-react";
import yaboaLogo from "../../assets/brand/yaboa-cropped.png";
import { Field } from "../components/common";
import { initials } from "../helpers";
import type { CurrentUser } from "../types";

type ProfileScreenProps = {
  user: CurrentUser | null;
  partiesCount: number;
  followersCount: number;
  followingCount: number;
  onRefresh: () => void;
  onSave: (user: CurrentUser) => Promise<boolean>;
  onLogout: () => void;
  readOnly: boolean;
};

export function ProfileScreen({ user, partiesCount, followersCount, followingCount, onRefresh, onSave, onLogout, readOnly }: ProfileScreenProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CurrentUser | null>(user);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(user);
    setMessage("");
  }, [user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;

    const saved = await onSave(form);
    if (saved) {
      setEditing(false);
      setMessage("Perfil atualizado.");
    }
  }

  const current = form || user;
  const favoriteTagsText = current?.favoriteTags.join(", ") || "";

  return (
    <section className="screen with-nav">
      <header className="profile-card">
        <img className="profile-logo" src={yaboaLogo} alt="Yaboa" />
        <div className="profile-photo-wrap">
          {current?.avatarUrl ? (
            <img className="profile-photo" src={current.avatarUrl} alt={current.name} />
          ) : (
            <div className="profile-avatar">{initials(current?.name || "YA")}</div>
          )}
          <span className="profile-photo-badge">
            <Camera size={14} />
          </span>
        </div>
        <h1>{current?.name}</h1>
        <p>@{current?.username}</p>
        {current?.bio && <small>{current.bio}</small>}
      </header>

      <div className="stats-grid">
        <div>
          <strong>{partiesCount}</strong>
          <span>festas</span>
        </div>
        <div>
          <strong>{followersCount}</strong>
          <span>seguidores</span>
        </div>
        <div>
          <strong>{followingCount}</strong>
          <span>seguindo</span>
        </div>
      </div>

      <article className="profile-info-card">
        <div className="profile-info-line">
          <UserRound size={18} />
          <span>{current?.email}</span>
        </div>
        <div className="profile-info-line">
          <AtSign size={18} />
          <span>{favoriteTagsText || "Sem preferencias cadastradas"}</span>
        </div>
      </article>

      {readOnly && <p className="read-only-notice">Conta de convidado: você pode explorar o app, mas não alterar dados.</p>}

      {!readOnly && editing && current ? (
        <form className="profile-edit-card" onSubmit={submit}>
          <Field label="Nome" value={current.name} onChange={(value) => setForm({ ...current, name: value })} required />
            <Field
              label="Nome de usuario"
              value={current.username}
              onChange={(value) => setForm({ ...current, username: value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "") })}
              required
            />
          <Field label="Foto de perfil URL" value={current.avatarUrl} onChange={(value) => setForm({ ...current, avatarUrl: value })} placeholder="https://..." />
          <label className="field">
            <span>Bio</span>
            <textarea value={current.bio} onChange={(event) => setForm({ ...current, bio: event.target.value })} maxLength={160} />
          </label>
          <Field
            label="Preferencias"
            value={favoriteTagsText}
            onChange={(value) => setForm({ ...current, favoriteTags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })}
            placeholder="funk, sertanejo, rooftop"
          />
          <div className="form-actions">
            <button type="button" className="ghost-button" onClick={() => { setEditing(false); setForm(user); }}>
              <X size={16} /> Cancelar
            </button>
            <button className="primary-button">
              <Save size={16} /> Salvar
            </button>
          </div>
        </form>
      ) : !readOnly ? (
        <button className="primary-button full" onClick={() => setEditing(true)}>
          <Edit3 size={16} /> Editar perfil
        </button>
      ) : null}

      {message && <p className="form-message success">{message}</p>}

      <article className="setup-card">
        <h2>Conta Yaboa</h2>
        <p>Seu perfil aparece para seguidores pelo username. Quando duas pessoas se seguem, o chat entre elas fica disponivel.</p>
      </article>

      <button className="ghost-button full" onClick={onRefresh}>
        <RefreshCw size={16} /> Atualizar dados
      </button>
      <button className="ghost-button full" onClick={onLogout}>
        Sair
      </button>
    </section>
  );
}

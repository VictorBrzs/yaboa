import { FormEvent, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { createBlankParty } from "../constants";
import { Field } from "../components/common";
import { buildAddress, formatCep, lookupCep } from "../geocoding";
import type { Party, UserLocation, Visibility } from "../types";

type CreatePartyScreenProps = {
  draft: Party | null;
  busy: boolean;
  userLocation: UserLocation;
  onSave: (party: Party) => void;
  onCancel: () => void;
};

export function CreatePartyScreen({ draft, busy, userLocation, onSave, onCancel }: CreatePartyScreenProps) {
  const [form, setForm] = useState<Party>(() => draft || createBlankParty(userLocation));
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [complement, setComplement] = useState("");
  const [cepStatus, setCepStatus] = useState("");
  const [checkingCep, setCheckingCep] = useState(false);

  useEffect(() => {
    setForm(draft || createBlankParty(userLocation));
    setCep("");
    setStreet("");
    setNumber("");
    setDistrict("");
    setCity("");
    setStateUf("");
    setComplement("");
    setCepStatus("");
  }, [draft, userLocation.lat, userLocation.lng]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const preparedParty = {
      ...form,
      tags: Array.isArray(form.tags) ? form.tags : String(form.tags).split(",").map((tag) => tag.trim()).filter(Boolean),
    };

    onSave(preparedParty);
  }

  function updateAddress(next = { street, number, complement, district, city, state: stateUf }) {
    const address = buildAddress(next);
    setForm((current) => ({ ...current, address }));
  }

  async function findCep() {
    setCheckingCep(true);
    setCepStatus("");

    try {
      const result = await lookupCep(cep);
      setStreet(result.street);
      setDistrict(result.district);
      setCity(result.city);
      setStateUf(result.state);
      updateAddress({ ...result, number, complement });
      setCepStatus("CEP encontrado. Complete o numero.");
    } catch (error: any) {
      setCepStatus(error?.message || "CEP nao encontrado.");
    } finally {
      setCheckingCep(false);
    }
  }

  return (
    <section className="screen with-nav">
      <header className="page-header">
        <p className="eyebrow">Criar Festa</p>
        <h1>{draft ? "Editar evento" : "Coloque uma festa no mapa"}</h1>
      </header>
      <form className="party-form" onSubmit={submit}>
        <Field label="Nome da festa" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required />
        <Field label="Local" value={form.venueName} onChange={(value) => setForm({ ...form, venueName: value })} required />
        <div className="address-helper">
          <div className="address-cep-row">
            <Field label="CEP" value={cep} onChange={(value) => setCep(formatCep(value))} placeholder="00000-000" />
            <button type="button" className="ghost-button" onClick={findCep} disabled={checkingCep || busy}>
              <Search size={16} /> {checkingCep ? "Buscando..." : "Buscar"}
            </button>
          </div>
          {cepStatus && <p className={`form-message ${cepStatus.startsWith("CEP encontrado") ? "success" : ""}`}>{cepStatus}</p>}
          <div className="two-grid">
            <Field label="Rua" value={street} onChange={(value) => { setStreet(value); updateAddress({ street: value, number, complement, district, city, state: stateUf }); }} />
            <Field label="Numero" value={number} onChange={(value) => { setNumber(value); updateAddress({ street, number: value, complement, district, city, state: stateUf }); }} />
          </div>
          <div className="two-grid">
            <Field label="Bairro" value={district} onChange={(value) => { setDistrict(value); updateAddress({ street, number, complement, district: value, city, state: stateUf }); }} />
            <Field label="Cidade" value={city} onChange={(value) => { setCity(value); updateAddress({ street, number, complement, district, city: value, state: stateUf }); }} />
          </div>
          <div className="two-grid compact-grid">
            <Field label="UF" value={stateUf} onChange={(value) => { setStateUf(value.toUpperCase().slice(0, 2)); updateAddress({ street, number, complement, district, city, state: value.toUpperCase().slice(0, 2) }); }} />
            <Field label="Complemento" value={complement} onChange={(value) => { setComplement(value); updateAddress({ street, number, complement: value, district, city, state: stateUf }); }} placeholder="Opcional" />
          </div>
          <Field
            label="Endereco completo"
            value={form.address}
            onChange={(value) => {
              setForm({ ...form, address: value });
            }}
            placeholder="Rua, numero, bairro, cidade - UF"
            required
          />
        </div>
        <div className="two-grid">
          <Field label="Data" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} required />
          <Field label="Hora" type="time" value={form.time} onChange={(value) => setForm({ ...form, time: value })} required />
        </div>
        <div className="two-grid">
          <Field label="Preco" value={form.price} onChange={(value) => setForm({ ...form, price: value })} />
          <label className="field">
            <span>Vibe</span>
            <select value={form.vibe} onChange={(event) => setForm({ ...form, vibe: event.target.value })}>
              <option>Bombando</option>
              <option>Lotado</option>
              <option>Vale a pena</option>
              <option>Tranquilo</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Quem pode ver</span>
          <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as Visibility })}>
            <option value="public">Publico</option>
            <option value="friends">Apenas amigos</option>
          </select>
        </label>
        <Field label="Imagem URL" value={form.imageUrl} onChange={(value) => setForm({ ...form, imageUrl: value })} />
        <label className="field">
          <span>Descricao</span>
          <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </label>
        <Field
          label="Tags"
          value={form.tags.join(", ")}
          onChange={(value) => setForm({ ...form, tags: value.split(",").map((tag) => tag.trim()).filter(Boolean) })}
        />
        <div className="form-actions">
          <button type="button" className="ghost-button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="primary-button" disabled={busy}>
            <Plus size={18} /> Salvar festa
          </button>
        </div>
      </form>
    </section>
  );
}

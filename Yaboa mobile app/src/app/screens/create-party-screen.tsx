import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, LocateFixed, MapPin, Plus } from "lucide-react";
import { createBlankParty } from "../constants";
import { Field } from "../components/common";
import { buildAddress, formatCep, geocodeAddress, lookupCep } from "../geocoding";
import { imageFileToDataUrl } from "../helpers";
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
  const [pinStatus, setPinStatus] = useState("");
  const [addressMode, setAddressMode] = useState<"cep" | "current" | "existing">(() => draft?.address ? "existing" : "cep");
  const [imageStatus, setImageStatus] = useState("");
  const [checkingPin, setCheckingPin] = useState(false);
  const cepLookupRequest = useRef(0);

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
    setPinStatus("");
    setAddressMode(draft?.address ? "existing" : "cep");
    setImageStatus("");
  }, [draft, userLocation.lat, userLocation.lng]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const preparedParty = {
      ...form,
      address: form.address.trim() || "Pin marcado pelo usuario",
      tags: Array.isArray(form.tags) ? form.tags : String(form.tags).split(",").map((tag) => tag.trim()).filter(Boolean),
    };

    onSave(preparedParty);
  }

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await imageFileToDataUrl(file);
      setForm((current) => ({ ...current, imageUrl }));
      setImageStatus("Foto anexada.");
    } catch (error: any) {
      setImageStatus(error?.message || "Nao foi possivel anexar a foto.");
    }

    event.target.value = "";
  }

  function updateAddress(next = { street, number, complement, district, city, state: stateUf }) {
    const address = buildAddress(next);
    setForm((current) => ({ ...current, address }));
  }

  async function findCep(value = cep) {
    const request = ++cepLookupRequest.current;
    setCepStatus("Buscando endereco pelo CEP...");

    try {
      const result = await lookupCep(value);
      if (request !== cepLookupRequest.current) return;
      setStreet(result.street);
      setDistrict(result.district);
      setCity(result.city);
      setStateUf(result.state);
      const address = buildAddress({ ...result, number, complement });
      setForm((current) => ({ ...current, address }));
      setCepStatus(address ? `Endereco encontrado: ${address}` : "CEP encontrado. Informe o numero do local.");
    } catch (error: any) {
      if (request === cepLookupRequest.current) setCepStatus(error?.message || "CEP nao encontrado.");
    }
  }

  async function confirmPin() {
    setCheckingPin(true);
    setPinStatus("");

    try {
      const result = await geocodeAddress(form.venueName, form.address);
      setForm((current) => ({
        ...current,
        lat: result.lat,
        lng: result.lng,
      }));
      setPinStatus("Local encontrado no mapa.");
    } catch (error: any) {
      setPinStatus(error?.message || "Nao foi possivel localizar este endereco.");
    } finally {
      setCheckingPin(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setPinStatus("Este aparelho nao disponibiliza localizacao.");
      return;
    }

    setCheckingPin(true);
    setPinStatus("Obtendo sua localizacao...");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({ ...current, lat: coords.latitude, lng: coords.longitude, address: "Localizacao atual" }));
        setAddressMode("current");
        cepLookupRequest.current += 1;
        setCep("");
        setNumber("");
        setCepStatus("");
        setPinStatus("Localizacao atual marcada no mapa.");
        setCheckingPin(false);
      },
      () => {
        setPinStatus("Nao foi possivel acessar sua localizacao. Verifique a permissao do aparelho.");
        setCheckingPin(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <section className="screen with-nav">
      <header className="page-header">
        <p className="eyebrow">Criar Festa</p>
        <h1>{draft ? "Editar evento" : "Publique em poucos passos"}</h1>
      </header>
      <form className="party-form" onSubmit={submit}>
        <Field label="Nome da festa" value={form.title} onChange={(value) => setForm({ ...form, title: value })} required />
        <Field label="Local" value={form.venueName} onChange={(value) => setForm({ ...form, venueName: value })} required />
        <div className="address-helper">
          <button type="button" className="location-button primary-button" onClick={useCurrentLocation} disabled={busy || checkingPin}>
            <LocateFixed size={17} /> Usar minha localizacao
          </button>
          <div className="address-cep-row">
            <Field label="CEP" value={cep} onChange={(value) => {
              const nextCep = formatCep(value);
              setCep(nextCep);
              setAddressMode("cep");
              if (nextCep.replace(/\D/g, "").length !== 8) cepLookupRequest.current += 1;
              setForm((current) => ({ ...current, address: "" }));
              setCepStatus("");
              if (nextCep.replace(/\D/g, "").length === 8) void findCep(nextCep);
            }} placeholder="00000-000" required={addressMode === "cep"} />
            <Field label="Numero" value={number} onChange={(value) => {
              setNumber(value);
              updateAddress({ street, number: value, complement, district, city, state: stateUf });
            }} onBlur={() => { if (addressMode === "cep" && form.address.trim()) void confirmPin(); }} placeholder="Numero" required={addressMode === "cep"} />
          </div>
          {cepStatus && <p className={`form-message ${cepStatus.startsWith("Endereco encontrado") ? "success" : ""}`}>{cepStatus}</p>}
          {pinStatus && <p className={`form-message ${pinStatus.includes("marcada") || pinStatus.includes("encontrado") ? "success" : ""}`}>{pinStatus}</p>}
          <div className="pin-confirmation">
            <div>
              <MapPin size={17} />
              <span>{form.address || "O endereco sera localizado no mapa"}</span>
            </div>
          </div>
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
        <div className="image-picker">
          <span>Foto da festa</span>
          {form.imageUrl && <img src={form.imageUrl} alt="" />}
          <div className="image-picker-actions">
            <label>
              <ImagePlus size={16} /> Galeria
              <input type="file" accept="image/*" onChange={chooseImage} />
            </label>
            <label>
              <Camera size={16} /> Camera
              <input type="file" accept="image/*" capture="environment" onChange={chooseImage} />
            </label>
          </div>
          {imageStatus && <p className={`form-message ${imageStatus.startsWith("Foto anexada") ? "success" : ""}`}>{imageStatus}</p>}
        </div>
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

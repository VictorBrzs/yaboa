import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CalendarDays, LocateFixed, MapPin, Navigation, Plus, Search, UsersRound } from "lucide-react";
import { formatDate } from "../helpers";
import type { Party, UserLocation } from "../types";

type MapScreenProps = {
  parties: Party[];
  query: string;
  userLocation: UserLocation;
  onRequestLocation: () => Promise<boolean>;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  readOnly: boolean;
};

export function MapScreen({ parties, query, userLocation, onRequestLocation, onQuery, onSelect, onCreate, readOnly }: MapScreenProps) {
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");

  async function requestLocation() {
    if (locating) return;
    setLocating(true);
    setLocationMessage("");
    try {
      const success = await onRequestLocation();
      setLocationMessage(success ? "Localização atualizada." : "Não foi possível acessar sua localização. Confira a permissão do aparelho.");
    } catch {
      setLocationMessage("Não foi possível acessar sua localização. Confira a permissão do aparelho.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <section className="map-screen-full">
      <RealPartyMap parties={parties} userLocation={userLocation} onSelect={onSelect} />
      <label className="map-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.currentTarget.value)}
          placeholder="Buscar festa ou local"
          aria-label="Buscar festas por nome, local ou estilo"
        />
      </label>
      <button
        type="button"
        className="map-location-button"
        onClick={requestLocation}
        disabled={locating}
        aria-label={locating ? "Obtendo localização" : "Usar minha localização"}
        title="Usar minha localização"
      >
        <LocateFixed size={20} />
      </button>
      {locationMessage && <span className="map-location-status" role="status">{locationMessage}</span>}
      {!readOnly && (
        <button type="button" className="map-create-button" onClick={onCreate} aria-label="Criar festa">
          <Plus size={24} />
        </button>
      )}
    </section>
  );
}

function RealPartyMap({
  parties,
  userLocation,
  onSelect,
}: {
  parties: Party[];
  userLocation: UserLocation;
  onSelect: (id: string) => void;
}) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapElement.current || mapInstance.current) return;

    mapInstance.current = L.map(mapElement.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([userLocation.lat, userLocation.lng], 13);

    L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(mapInstance.current);
    L.control.zoom({ position: "bottomright" }).addTo(mapInstance.current);
    window.setTimeout(() => mapInstance.current?.invalidateSize(), 80);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    const bounds = L.latLngBounds([]);
    if (userLocation.label === "Perto de voce") {
      const userIcon = L.divIcon({
        className: "leaflet-user-dot",
        html: "<span></span>",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      markers.current.push(L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map).bindPopup("Voce esta aqui"));
      bounds.extend([userLocation.lat, userLocation.lng]);
    }

    parties.forEach((party) => {
      const markerIcon = L.divIcon({
        className: "leaflet-party-dot",
        html: `<span>${party.visibility === "friends" ? "A" : "P"}</span>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = party.title;
      const venue = document.createElement("div");
      venue.textContent = party.venueName;
      const distance = document.createElement("div");
      distance.textContent = `${party.distanceKm?.toFixed(1) ?? "?"} km`;
      popup.append(title, venue, distance);

      const marker = L.marker([party.lat, party.lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(popup);

      marker.on("click", () => onSelect(party.id));
      markers.current.push(marker);
      bounds.extend([party.lat, party.lng]);
    });

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.28), { maxZoom: 14 });
    else map.setView([userLocation.lat, userLocation.lng], 13);
  }, [parties, userLocation, onSelect]);

  return (
    <div className="map-visual real-map-wrap full-real-map">
      <div className="real-map" ref={mapElement} />
      <div className="map-card">
        <Navigation size={16} />
        <span aria-live="polite">
          {query.trim() && parties.length === 0
            ? "Nenhuma festa encontrada"
            : userLocation.label === "Perto de voce"
              ? `${parties.length} festas próximas`
              : "Ative sua localização para ver distâncias"}
        </span>
      </div>
    </div>
  );
}

export function PartyCard({ party, onClick }: { party: Party; onClick: () => void }) {
  return (
    <button type="button" className="party-card" onClick={onClick}>
      <img src={party.imageUrl} alt="" />
      <div className="party-card-body">
        <div className="card-row">
          <span className="vibe-pill">{party.vibe}</span>
          <span className="muted">{party.distanceKm !== null ? `${party.distanceKm.toFixed(1)} km` : `${party.going} pessoas`}</span>
        </div>
        <h3>{party.title}</h3>
        <p>
          <MapPin size={14} /> {party.venueName}
        </p>
        <p>
          <CalendarDays size={14} /> {formatDate(party.date)} as {party.time}
        </p>
        <p>
          <UsersRound size={14} /> {party.visibility === "friends" ? "Amigos" : "Publico"} - {party.going}
        </p>
      </div>
    </button>
  );
}

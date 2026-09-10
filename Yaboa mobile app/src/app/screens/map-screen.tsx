import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CalendarDays, MapPin, Navigation, Plus, UsersRound } from "lucide-react";
import { formatDate } from "../helpers";
import type { Party, UserLocation } from "../types";

type MapScreenProps = {
  parties: Party[];
  query: string;
  userLocation: UserLocation;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  readOnly: boolean;
};

export function MapScreen({ parties, query, userLocation, onQuery, onSelect, onCreate, readOnly }: MapScreenProps) {
  void query;
  void onQuery;

  return (
    <section className="map-screen-full">
      <RealPartyMap parties={parties} userLocation={userLocation} onSelect={onSelect} />
      {!readOnly && (
        <button className="map-create-button" onClick={onCreate} aria-label="Criar festa">
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

    const userIcon = L.divIcon({
      className: "leaflet-user-dot",
      html: "<span></span>",
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    markers.current.push(L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map).bindPopup("Voce esta aqui"));

    parties.forEach((party) => {
      const markerIcon = L.divIcon({
        className: "leaflet-party-dot",
        html: `<span>${party.visibility === "friends" ? "A" : "P"}</span>`,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      const marker = L.marker([party.lat, party.lng], { icon: markerIcon })
        .addTo(map)
        .bindPopup(`<strong>${party.title}</strong><br>${party.venueName}<br>${party.distanceKm?.toFixed(1) ?? "?"} km`);

      marker.on("click", () => onSelect(party.id));
      markers.current.push(marker);
    });

    const bounds = L.latLngBounds([[userLocation.lat, userLocation.lng]]);
    parties.forEach((party) => bounds.extend([party.lat, party.lng]));
    map.fitBounds(bounds.pad(0.28), { maxZoom: 14 });
  }, [parties, userLocation, onSelect]);

  return (
    <div className="map-visual real-map-wrap full-real-map">
      <div className="real-map" ref={mapElement} />
      <div className="map-card">
        <Navigation size={16} />
        <span>{parties.length} festas ao vivo perto de voce</span>
      </div>
    </div>
  );
}

export function PartyCard({ party, onClick }: { party: Party; onClick: () => void }) {
  return (
    <button className="party-card" onClick={onClick}>
      <img src={party.imageUrl} alt="" />
      <div className="party-card-body">
        <div className="card-row">
          <span className="vibe-pill">{party.vibe}</span>
          <span className="muted">{party.distanceKm !== null ? `${party.distanceKm.toFixed(1)} km` : `${party.going} vao`}</span>
        </div>
        <h3>{party.title}</h3>
        <p>
          <MapPin size={14} /> {party.venueName}
        </p>
        <p>
          <CalendarDays size={14} /> {formatDate(party.date)} as {party.time}
        </p>
        <p>
          <UsersRound size={14} /> {party.visibility === "friends" ? "Amigos" : "Publico"} - {party.going} vao
        </p>
      </div>
    </button>
  );
}

import type { Party, UserLocation } from "./types";

export const fallbackImage =
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80";

export const defaultLocation: UserLocation = {
  lat: -23.5505,
  lng: -46.6333,
  label: "Centro de Sao Paulo",
};

const blankParty: Party = {
  id: "",
  venueId: null,
  title: "",
  venueName: "",
  address: "",
  date: "",
  time: "",
  price: "",
  vibe: "Vale a pena",
  description: "",
  lat: defaultLocation.lat,
  lng: defaultLocation.lng,
  tags: [],
  imageUrl: "",
  createdBy: null,
  going: 0,
  visibility: "public",
  isOwner: false,
  isGoing: false,
  distanceKm: null,
  friendsGoing: [],
  attendees: [],
};

export function createBlankParty(userLocation: UserLocation): Party {
  return {
    ...blankParty,
    date: new Date().toISOString().slice(0, 10),
    time: "22:00",
    price: "A confirmar",
    lat: userLocation.lat,
    lng: userLocation.lng,
  };
}

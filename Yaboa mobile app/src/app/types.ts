export type Tab = "map" | "events" | "social" | "my-parties" | "profile";
export type View = "login" | "app";
export type AppStatus = "checking" | "ready" | "setup-error";
export type Visibility = "public" | "friends";

export type Party = {
  id: string;
  venueId?: string | null;
  title: string;
  venueName: string;
  address: string;
  date: string;
  time: string;
  price: string;
  vibe: string;
  description: string;
  lat: number;
  lng: number;
  tags: string[];
  imageUrl: string;
  createdBy: string | null;
  going: number;
  visibility: Visibility;
  isOwner: boolean;
  isGoing: boolean;
  distanceKm: number | null;
  friendsGoing: string[];
  attendees: PartyAttendee[];
};

export type PartyAttendee = {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  accessType: "membro" | "convidado" | "administrador";
  avatarUrl: string;
  bio: string;
  favoriteTags: string[];
};

export type Friend = {
  id: string;
  name: string;
  username: string;
  avatar: string;
  avatarUrl?: string;
};

export type FollowProfile = Friend & {
  followedByMe: boolean;
  followsMe: boolean;
  isFriend: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  body: string;
  createdAt: string;
};

export type UserLocation = {
  lat: number;
  lng: number;
  label: string;
};

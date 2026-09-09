import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { AuthScreen } from "./components/auth-screen";
import { BottomNav } from "./components/bottom-nav";
import { BusyOverlay } from "./components/common";
import { defaultLocation, fallbackImage } from "./constants";
import { geocodeAddress } from "./geocoding";
import { distanceKm, initials, readableDbError } from "./helpers";
import { ensureProfile, userFromProfile, userFromSupabase } from "./profile";
import { CreatePartyScreen } from "./screens/create-party-screen";
import { EventsScreen } from "./screens/events-screen";
import { MapScreen } from "./screens/map-screen";
import { MyPartiesScreen } from "./screens/my-parties-screen";
import { PartyDetails } from "./screens/party-details";
import { ProfileScreen } from "./screens/profile-screen";
import { SocialScreen } from "./screens/social-screen";
import type {
  AppStatus,
  ChatMessage,
  CurrentUser,
  Friend,
  FollowProfile,
  Party,
  Tab,
  UserLocation,
  View,
  Visibility,
} from "./types";
import "../styles/app.css";

export default function App() {
  const [view, setView] = useState<View>("login");
  const [tab, setTab] = useState<Tab>("map");
  const [status, setStatus] = useState<AppStatus>("checking");
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [followProfiles, setFollowProfiles] = useState<FollowProfile[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation>(defaultLocation);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [partyFormOpen, setPartyFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busyMessage, setBusyMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    bootstrap();
    resolveUserLocation();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setView("login");
      }
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (status === "ready" && user && !user.isGuest) refreshData(user.id);
  }, [userLocation.lat, userLocation.lng]);

  function resolveUserLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          label: "Perto de voce",
        });
      },
      () => setUserLocation(defaultLocation),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 1000 * 60 * 10 },
    );
  }

  async function bootstrap() {
    setBusyMessage("Carregando app...");
    setErrorMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const activeUser = data.session?.user ? userFromSupabase(data.session.user) : null;

      await assertSchemaReady();
      setStatus("ready");

      if (activeUser) {
        await ensureProfile(activeUser);
        const profiledUser = await loadCurrentUser(activeUser);
        setUser(profiledUser);
        setView("app");
      }

      await refreshData(activeUser?.id);
    } catch (error: any) {
      setStatus("setup-error");
      setErrorMessage(error?.message || "Nao foi possivel carregar o app.");
    } finally {
      setBusyMessage("");
    }
  }

  async function assertSchemaReady() {
    const [{ error: profilesError }, { error: venuesError }, { error: eventsError }, { error: followsError }, { error: chatError }] = await Promise.all([
      supabase.from("profiles").select("id,email,username").limit(1),
      supabase.from("venues").select("id").limit(1),
      supabase.from("events").select("id,visibility").limit(1),
      supabase.from("follows").select("follower_id,following_id").limit(1),
      supabase.from("chat_messages").select("id").limit(1),
    ]);

    if (profilesError || venuesError || eventsError || followsError || chatError) {
      throw new Error("Nao foi possivel iniciar o app. Tente novamente em instantes.");
    }
  }

  async function refreshData(userId = user?.id) {
    if (!userId || (user && user.isGuest)) {
      setFriends([]);
      setFollowProfiles([]);
      setFollowingCount(0);
      setFollowersCount(0);
      setParties(await loadParties(undefined, []));
      setChatMessages([]);
      return;
    }

    const social = userId ? await loadSocial(userId) : { friends: [], profiles: [], following: 0, followers: 0 };
    const [loadedParties, loadedMessages] = await Promise.all([
      loadParties(userId, social.friends),
      userId ? loadChatMessages(userId) : Promise.resolve([]),
    ]);

    setFriends(social.friends);
    setFollowProfiles(social.profiles);
    setFollowingCount(social.following);
    setFollowersCount(social.followers);
    setParties(loadedParties);
    setChatMessages(loadedMessages);
  }

  async function loadCurrentUser(baseUser: CurrentUser): Promise<CurrentUser> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,username,email,avatar_url,bio,preferences")
      .eq("id", baseUser.id)
      .maybeSingle();

    if (error) throw error;
    if (data && !data.email && baseUser.email) {
      await supabase.from("profiles").update({ email: baseUser.email }).eq("id", baseUser.id);
      data.email = baseUser.email;
    }
    return data ? userFromProfile(baseUser, data) : baseUser;
  }

  async function loadSocial(userId: string): Promise<{ friends: Friend[]; profiles: FollowProfile[]; following: number; followers: number }> {
    const [{ data: follows }, { data: profiles }] = await Promise.all([
      supabase.from("follows").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id,name,username,avatar_url"),
    ]);

    const followingIds = new Set((follows ?? []).filter((follow: any) => follow.follower_id === userId).map((follow: any) => follow.following_id));
    const followerIds = new Set((follows ?? []).filter((follow: any) => follow.following_id === userId).map((follow: any) => follow.follower_id));

    const socialProfiles: FollowProfile[] = (profiles ?? [])
      .filter((profile: any) => profile.id !== userId)
      .map((profile: any) => {
        const name = profile.name || profile.username || "Usuario";
        const followedByMe = followingIds.has(profile.id);
        const followsMe = followerIds.has(profile.id);

        return {
          id: profile.id,
          name,
          username: profile.username || "",
          avatar: initials(name),
          avatarUrl: profile.avatar_url || "",
          followedByMe,
          followsMe,
          isFriend: followedByMe && followsMe,
        };
      })
      .sort((a, b) => Number(b.isFriend) - Number(a.isFriend) || Number(b.followsMe) - Number(a.followsMe) || a.username.localeCompare(b.username));

    return {
      friends: socialProfiles.filter((profile) => profile.isFriend),
      profiles: socialProfiles,
      following: followingIds.size,
      followers: followerIds.size,
    };
  }

  async function loadParties(userId?: string, knownFriends: Friend[] = []): Promise<Party[]> {
    const [{ data: venues, error: venuesError }, { data: events, error: eventsError }, { data: attendees, error: attendeesError }, { data: profiles }] =
      await Promise.all([
        supabase.from("venues").select("*").order("created_at", { ascending: false }),
        supabase.from("events").select("*").order("event_date", { ascending: true }),
        supabase.from("event_attendees").select("event_id,user_id"),
        supabase.from("profiles").select("id,name,username"),
      ]);

    if (venuesError) throw venuesError;
    if (eventsError) throw eventsError;
    if (attendeesError) throw attendeesError;

    const friendIds = new Set(knownFriends.map((friend) => friend.id));
    const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

    return (events ?? [])
      .map((event: any): Party | null => {
        const venue = (venues ?? []).find((item: any) => item.id === event.venue_id);
        const eventAttendees = (attendees ?? []).filter((item: any) => item.event_id === event.id);
        const visibility: Visibility = event.visibility === "friends" ? "friends" : "public";
        const attendeeProfiles = eventAttendees.map((item: any) => {
          const profile: any = profileById.get(item.user_id);
          const name = profile?.name || profile?.username || "Usuario";
          return {
            id: item.user_id,
            name,
            username: profile?.username || "",
            avatarUrl: profile?.avatar_url || "",
          };
        });
        const friendsGoing = eventAttendees
          .filter((item: any) => friendIds.has(item.user_id))
          .map((item: any) => {
            const profile: any = profileById.get(item.user_id);
            return profile?.name || profile?.username || "Amigo";
          });
        const lat = Number(venue?.lat);
        const lng = Number(venue?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          id: event.id,
          venueId: venue?.id ?? null,
          title: event.title,
          venueName: venue?.name || "Local a confirmar",
          address: venue?.address || "Endereco a confirmar",
          date: event.event_date,
          time: event.event_time?.slice(0, 5) || "22:00",
          price: event.price_range || "A confirmar",
          vibe: event.promoted ? "Bombando" : "Vale a pena",
          description: event.description || "",
          lat,
          lng,
          tags: event.tags || venue?.tags || [],
          imageUrl: event.image_url || venue?.image_url || fallbackImage,
          createdBy: event.created_by,
          going: eventAttendees.length,
          visibility,
          isOwner: Boolean(userId && event.created_by === userId),
          isGoing: Boolean(userId && eventAttendees.some((item: any) => item.user_id === userId)),
          distanceKm: distanceKm(userLocation.lat, userLocation.lng, lat, lng),
          friendsGoing,
          attendees: attendeeProfiles,
        };
      })
      .filter((party): party is Party => Boolean(party))
      .filter((party) => party.visibility === "public" || party.isOwner || Boolean(party.createdBy && friendIds.has(party.createdBy)))
      .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  }

  async function loadChatMessages(userId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) throw error;

    return (data ?? []).map((message: any) => ({
      id: message.id,
      senderId: message.sender_id,
      receiverId: message.receiver_id,
      body: message.body,
      createdAt: message.created_at,
    }));
  }

  async function updateProfile(nextUser: CurrentUser): Promise<boolean> {
    if (!user || user.isGuest) {
      setErrorMessage("Visitantes nao podem alterar o perfil.");
      return false;
    }

    setBusyMessage("Atualizando perfil...");
    setErrorMessage("");

    try {
      const cleanTags = nextUser.favoriteTags.map((tag) => tag.trim()).filter(Boolean);
      const cleanUsername = nextUser.username.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 24);
      const { error } = await supabase
        .from("profiles")
        .update({
          name: nextUser.name.trim() || user.name,
          email: user.email,
          username: cleanUsername || user.username,
          avatar_url: nextUser.avatarUrl.trim() || null,
          bio: nextUser.bio.trim() || null,
          preferences: { types: ["party", "bar"], tags: cleanTags },
        })
        .eq("id", user.id);

      if (error) throw error;

      setUser({
        ...nextUser,
        name: nextUser.name.trim() || user.name,
        username: cleanUsername || user.username,
        avatarUrl: nextUser.avatarUrl.trim(),
        bio: nextUser.bio.trim(),
        favoriteTags: cleanTags,
      });
      await refreshData(user.id);
      return true;
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
      return false;
    } finally {
      setBusyMessage("");
    }
  }

  async function saveParty(party: Party): Promise<boolean> {
    if (!user || user.isGuest) {
      setErrorMessage("Visitantes nao podem criar ou editar festas.");
      return false;
    }
    if (party.id && party.createdBy !== user.id) {
      setErrorMessage("Apenas o criador pode alterar esta festa.");
      return false;
    }

    setBusyMessage("Validando endereco...");
    setErrorMessage("");

    try {
      const location = await geocodeAddress(party.venueName, party.address);
      const imageUrl = party.imageUrl || fallbackImage;
      const venuePayload = {
        name: party.venueName,
        type: "party",
        lat: location.lat,
        lng: location.lng,
        address: location.displayName,
        description: party.description,
        image_url: imageUrl,
        tags: party.tags,
        created_by: user.id,
      };

      setBusyMessage(party.id ? "Salvando alteracoes..." : "Criando festa...");
      const venueRequest = party.venueId
        ? supabase.from("venues").update(venuePayload).eq("id", party.venueId).select("*").single()
        : supabase.from("venues").insert(venuePayload).select("*").single();
      const { data: venue, error: venueError } = await venueRequest;
      if (venueError) throw venueError;

      const eventPayload = {
        venue_id: venue.id,
        created_by: user.id,
        title: party.title,
        description: party.description,
        image_url: imageUrl,
        event_date: party.date,
        event_time: party.time,
        price_range: party.price,
        category: "party",
        tags: party.tags,
        max_attendees: null,
        promoted: party.vibe === "Bombando",
        visibility: party.visibility,
      };

      if (party.id) {
        const { error } = await supabase.from("events").update(eventPayload).eq("id", party.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(eventPayload);
        if (error) throw error;
      }

      await refreshData(user.id);
      return true;
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
      return false;
    } finally {
      setBusyMessage("");
    }
  }

  async function deleteParty(party: Party) {
    if (!user || user.isGuest) {
      setErrorMessage("Visitantes nao podem excluir festas.");
      return;
    }
    if (party.createdBy !== user.id) {
      setErrorMessage("Apenas o criador pode excluir esta festa.");
      return;
    }

    setBusyMessage("Excluindo festa...");
    setErrorMessage("");

    try {
      const { error: eventError } = await supabase.from("events").delete().eq("id", party.id);
      if (eventError) throw eventError;

      if (party.venueId) await supabase.from("venues").delete().eq("id", party.venueId);

      setSelectedPartyId(null);
      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function removePartyAttendee(partyId: string, attendeeId: string) {
    const party = parties.find((item) => item.id === partyId);
    if (!user || user.isGuest || !party?.isOwner) return;

    setBusyMessage("Removendo usuario da lista...");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("event_attendees").delete().eq("event_id", partyId).eq("user_id", attendeeId);
      if (error) throw error;
      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function checkIn(party: Party) {
    if (!user || user.isGuest || !party.venueId) {
      setErrorMessage("Visitante nao pode confirmar presenca.");
      return;
    }

    setBusyMessage("Confirmando presenca...");
    setErrorMessage("");

    try {
      const [{ error: checkinError }, { error: attendeeError }] = await Promise.all([
        supabase.from("check_ins").insert({
          user_id: user.id,
          venue_id: party.venueId,
          status: party.visibility === "friends" ? "private" : "public",
          venue_status: party.vibe,
        }),
        supabase.from("event_attendees").upsert({ event_id: party.id, user_id: user.id }),
      ]);

      if (checkinError) throw checkinError;
      if (attendeeError) throw attendeeError;

      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function followUser(term: string) {
    if (!user || user.isGuest || !term.trim()) return;
    setBusyMessage("Seguindo usuario...");
    setErrorMessage("");

    try {
      const search = term.trim().replace(/^@/, "");
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id,name,username")
        .eq("username", search.toLowerCase())
        .neq("id", user.id)
        .limit(1);

      if (error) throw error;
      const profile = profiles?.[0];
      if (!profile) throw new Error("Perfil nao encontrado. Busque pelo username exato.");

      const { error: followError } = await supabase.from("follows").upsert({ follower_id: user.id, following_id: profile.id });
      if (followError) throw followError;

      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function unfollowUser(profileId: string) {
    if (!user || user.isGuest) return;
    setBusyMessage("Atualizando seguidores...");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profileId);
      if (error) throw error;
      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function sendMessage(friendId: string, body: string) {
    if (!user || user.isGuest || !body.trim()) return;
    setBusyMessage("Enviando mensagem...");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("chat_messages").insert({
        sender_id: user.id,
        receiver_id: friendId,
        body: body.trim(),
      });
      if (error) throw error;
      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  function openCreateForm(draft: Party | null = null) {
    setEditingParty(draft);
    setSelectedPartyId(null);
    setPartyFormOpen(true);
    setTab("events");
  }

  const filteredParties = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return parties;
    return parties.filter((party) =>
      [party.title, party.venueName, party.address, party.vibe, party.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [parties, query]);

  const selectedParty = parties.find((party) => party.id === selectedPartyId) || null;

  if (view === "login") {
    return (
      <AuthScreen
        appStatus={status}
        busyMessage={busyMessage}
        errorMessage={errorMessage}
        onAuthenticated={async (nextUser) => {
          const profiledUser = await loadCurrentUser(nextUser);
          setUser(profiledUser);
          setView("app");
          await refreshData(profiledUser.id);
        }}
        onRetry={bootstrap}
      />
    );
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        {selectedParty ? (
          <PartyDetails
            party={selectedParty}
            busy={Boolean(busyMessage)}
            onBack={() => setSelectedPartyId(null)}
            onEdit={() => openCreateForm(selectedParty)}
            onDelete={() => deleteParty(selectedParty)}
            onCheckIn={() => checkIn(selectedParty)}
          />
        ) : (
          <>
            {tab === "map" && (
              <MapScreen
                parties={filteredParties}
                query={query}
                userLocation={userLocation}
                onQuery={setQuery}
                onSelect={setSelectedPartyId}
                onCreate={() => openCreateForm()}
              />
            )}
            {tab === "events" &&
              (partyFormOpen ? (
                <CreatePartyScreen
                  draft={editingParty}
                  busy={Boolean(busyMessage)}
                  userLocation={userLocation}
                  onCancel={() => {
                    setEditingParty(null);
                    setPartyFormOpen(false);
                  }}
                  onSave={async (party) => {
                    const saved = await saveParty(party);
                    if (saved) {
                      setEditingParty(null);
                      setPartyFormOpen(false);
                    }
                  }}
                />
              ) : (
                <EventsScreen parties={filteredParties} onCreate={() => openCreateForm()} onSelect={setSelectedPartyId} />
              ))}
            {tab === "social" && (
              <SocialScreen
                currentUserId={user?.id || ""}
                friends={friends}
                profiles={followProfiles}
                messages={chatMessages}
                onFollow={followUser}
                onUnfollow={unfollowUser}
                onSendMessage={sendMessage}
              />
            )}
            {tab === "my-parties" && (
              <MyPartiesScreen
                parties={parties.filter((party) => party.isOwner)}
                onCreate={() => openCreateForm()}
                onEdit={(party) => openCreateForm(party)}
                onSelect={setSelectedPartyId}
                onRemoveAttendee={removePartyAttendee}
              />
            )}
            {tab === "profile" && (
              <ProfileScreen
                user={user}
                partiesCount={parties.filter((party) => party.isOwner).length}
                followersCount={followersCount}
                followingCount={followingCount}
                onRefresh={() => refreshData(user?.id)}
                onSave={updateProfile}
                onLogout={async () => {
                  await supabase.auth.signOut();
                  setUser(null);
                  setView("login");
                }}
              />
            )}
          </>
        )}
        {errorMessage && <div className="toast-error">{errorMessage}</div>}
        {busyMessage && <BusyOverlay text={busyMessage} />}
        {!selectedParty && <BottomNav tab={tab} onChange={setTab} />}
      </main>
    </div>
  );
}

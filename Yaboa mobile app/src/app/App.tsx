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

  function hasWriteAccess() {
    if (!user) return false;
    if (user.accessType === "convidado") {
      setErrorMessage("A conta de convidado é apenas para visualização.");
      return false;
    }
    return true;
  }

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
    if (status !== "ready" || !user) return;

    void refreshData(user.id).catch((error: any) => {
      setErrorMessage(readableDbError(error?.message));
    });
  }, [status, user?.id, userLocation.lat, userLocation.lng]);

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

      setStatus("ready");

      if (activeUser) {
        await assertSchemaReady();
        await ensureProfile(activeUser);
        const profiledUser = await loadCurrentUser(activeUser);
        setUser(profiledUser);
        await refreshData(profiledUser.id);
        setView("app");
      }
    } catch (error: any) {
      setStatus("setup-error");
      setErrorMessage(error?.message || "Nao foi possivel carregar o app.");
    } finally {
      setBusyMessage("");
    }
  }

  async function assertSchemaReady() {
    const [{ error: usersError }, { error: placesError }, { error: eventsError }, { error: followsError }, { error: messagesError }] = await Promise.all([
      supabase.from("usuarios").select("id,email,nome_usuario").limit(1),
      supabase.from("locais").select("id").limit(1),
      supabase.from("eventos").select("id,visibilidade").limit(1),
      supabase.from("seguidores").select("seguidor_id,seguindo_id").limit(1),
      supabase.from("mensagens").select("id").limit(1),
    ]);

    if (usersError || placesError || eventsError || followsError || messagesError) {
      throw new Error("Não foi possível iniciar o app. Execute o script de banco de dados e tente novamente.");
    }
  }

  async function refreshData(userId = user?.id) {
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
      .from("usuarios")
      .select("id,nome,nome_usuario,email,url_avatar,biografia,preferencias,tipo_acesso")
      .eq("id", baseUser.id)
      .maybeSingle();

    if (error) throw error;
    if (data && !data.email && baseUser.email) {
      await supabase.from("usuarios").update({ email: baseUser.email }).eq("id", baseUser.id);
      data.email = baseUser.email;
    }
    return data ? userFromProfile(baseUser, data) : baseUser;
  }

  async function loadSocial(userId: string): Promise<{ friends: Friend[]; profiles: FollowProfile[]; following: number; followers: number }> {
    const [{ data: follows }, { data: profiles }] = await Promise.all([
      supabase.from("seguidores").select("*").order("criado_em", { ascending: false }),
      supabase.from("usuarios").select("id,nome,nome_usuario,url_avatar"),
    ]);

    const followingIds = new Set((follows ?? []).filter((follow: any) => follow.seguidor_id === userId).map((follow: any) => follow.seguindo_id));
    const followerIds = new Set((follows ?? []).filter((follow: any) => follow.seguindo_id === userId).map((follow: any) => follow.seguidor_id));

    const socialProfiles: FollowProfile[] = (profiles ?? [])
      .filter((profile: any) => profile.id !== userId)
      .map((profile: any) => {
        const name = profile.nome || profile.nome_usuario || "Usuário";
        const followedByMe = followingIds.has(profile.id);
        const followsMe = followerIds.has(profile.id);

        return {
          id: profile.id,
          name,
          username: profile.nome_usuario || "",
          avatar: initials(name),
          avatarUrl: profile.url_avatar || "",
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
        supabase.from("locais").select("*").order("criado_em", { ascending: false }),
        supabase.from("eventos").select("*").order("data_evento", { ascending: true }),
        supabase.from("participantes_eventos").select("evento_id,usuario_id"),
        supabase.from("usuarios").select("id,nome,nome_usuario,url_avatar"),
      ]);

    if (venuesError) throw venuesError;
    if (eventsError) throw eventsError;
    if (attendeesError) throw attendeesError;

    const friendIds = new Set(knownFriends.map((friend) => friend.id));
    const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

    return (events ?? [])
      .map((event: any): Party | null => {
        const venue = (venues ?? []).find((item: any) => item.id === event.local_id);
        const eventAttendees = (attendees ?? []).filter((item: any) => item.evento_id === event.id);
        const visibility: Visibility = event.visibilidade === "amigos" ? "friends" : "public";
        const attendeeProfiles = eventAttendees.map((item: any) => {
          const profile: any = profileById.get(item.usuario_id);
          const name = profile?.nome || profile?.nome_usuario || "Usuário";
          return {
            id: item.usuario_id,
            name,
            username: profile?.nome_usuario || "",
            avatarUrl: profile?.url_avatar || "",
          };
        });
        const friendsGoing = eventAttendees
          .filter((item: any) => friendIds.has(item.usuario_id))
          .map((item: any) => {
            const profile: any = profileById.get(item.usuario_id);
            return profile?.nome || profile?.nome_usuario || "Amigo";
          });
        const lat = Number(venue?.lat);
        const lng = Number(venue?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

        return {
          id: event.id,
          venueId: venue?.id ?? null,
          title: event.titulo,
          venueName: venue?.nome || "Local a confirmar",
          address: venue?.endereco || "Endereço a confirmar",
          date: event.data_evento,
          time: event.hora_evento?.slice(0, 5) || "22:00",
          price: event.faixa_preco || "A confirmar",
          vibe: event.promovido ? "Bombando" : "Vale a pena",
          description: event.descricao || "",
          lat,
          lng,
          tags: event.etiquetas || venue?.etiquetas || [],
          imageUrl: event.url_imagem || venue?.url_imagem || fallbackImage,
          createdBy: event.criado_por,
          going: eventAttendees.length,
          visibility,
          isOwner: Boolean(userId && event.criado_por === userId),
          isGoing: Boolean(userId && eventAttendees.some((item: any) => item.usuario_id === userId)),
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
      .from("mensagens")
      .select("*")
      .or(`remetente_id.eq.${userId},destinatario_id.eq.${userId}`)
      .order("criado_em", { ascending: true })
      .limit(200);

    if (error) throw error;

    return (data ?? []).map((message: any) => ({
      id: message.id,
      senderId: message.remetente_id,
      receiverId: message.destinatario_id,
      body: message.conteudo,
      createdAt: message.criado_em,
    }));
  }

  async function updateProfile(nextUser: CurrentUser): Promise<boolean> {
    if (!user || !hasWriteAccess()) return false;

    setBusyMessage("Atualizando perfil...");
    setErrorMessage("");

    try {
      const cleanTags = nextUser.favoriteTags.map((tag) => tag.trim()).filter(Boolean);
      const cleanUsername = nextUser.username.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 24);
      const { error } = await supabase
        .from("usuarios")
        .update({
          nome: nextUser.name.trim() || user.name,
          email: user.email,
          nome_usuario: cleanUsername || user.username,
          url_avatar: nextUser.avatarUrl.trim() || null,
          biografia: nextUser.bio.trim() || null,
          preferencias: { tipos: ["festa", "bar"], etiquetas: cleanTags },
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
    if (!user || !hasWriteAccess()) return false;
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
        nome: party.venueName,
        tipo: "festa",
        latitude: location.lat,
        longitude: location.lng,
        endereco: location.displayName,
        descricao: party.description,
        url_imagem: imageUrl,
        etiquetas: party.tags,
        criado_por: user.id,
      };

      setBusyMessage(party.id ? "Salvando alteracoes..." : "Criando festa...");
      const venueRequest = party.venueId
        ? supabase.from("locais").update(venuePayload).eq("id", party.venueId).select("*").single()
        : supabase.from("locais").insert(venuePayload).select("*").single();
      const { data: venue, error: venueError } = await venueRequest;
      if (venueError) throw venueError;

      const eventPayload = {
        local_id: venue.id,
        criado_por: user.id,
        titulo: party.title,
        descricao: party.description,
        url_imagem: imageUrl,
        data_evento: party.date,
        hora_evento: party.time,
        faixa_preco: party.price,
        categoria: "festa",
        etiquetas: party.tags,
        maximo_participantes: null,
        promovido: party.vibe === "Bombando",
        visibilidade: party.visibility === "friends" ? "amigos" : "publico",
      };

      if (party.id) {
        const { error } = await supabase.from("eventos").update(eventPayload).eq("id", party.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("eventos").insert(eventPayload);
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
    if (!user || !hasWriteAccess()) return;
    if (party.createdBy !== user.id) {
      setErrorMessage("Apenas o criador pode excluir esta festa.");
      return;
    }

    setBusyMessage("Excluindo festa...");
    setErrorMessage("");

    try {
      const { error: eventError } = await supabase.from("eventos").delete().eq("id", party.id);
      if (eventError) throw eventError;

      if (party.venueId) await supabase.from("locais").delete().eq("id", party.venueId);

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
    if (!user || !party?.isOwner || !hasWriteAccess()) return;

    setBusyMessage("Removendo usuario da lista...");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("participantes_eventos").delete().eq("evento_id", partyId).eq("usuario_id", attendeeId);
      if (error) throw error;
      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function checkIn(party: Party) {
    if (!user || !party.venueId || !hasWriteAccess()) return;

    setBusyMessage("Confirmando presenca...");
    setErrorMessage("");

    try {
      const [{ error: checkinError }, { error: attendeeError }] = await Promise.all([
        supabase.from("presencas").insert({
          usuario_id: user.id,
          local_id: party.venueId,
          visibilidade: party.visibility === "friends" ? "privada" : "publica",
          situacao_local: party.vibe === "Bombando" ? "bombando" : party.vibe === "Lotado" ? "lotado" : party.vibe === "Tranquilo" ? "tranquilo" : "vale_a_pena",
        }),
        supabase.from("participantes_eventos").upsert({ evento_id: party.id, usuario_id: user.id }),
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
    if (!user || !term.trim() || !hasWriteAccess()) return;
    setBusyMessage("Seguindo usuario...");
    setErrorMessage("");

    try {
      const search = term.trim().replace(/^@/, "");
      const { data: profiles, error } = await supabase
        .from("usuarios")
        .select("id,nome,nome_usuario")
        .eq("nome_usuario", search.toLowerCase())
        .neq("id", user.id)
        .limit(1);

      if (error) throw error;
      const profile = profiles?.[0];
      if (!profile) throw new Error("Perfil nao encontrado. Busque pelo username exato.");

      const { error: followError } = await supabase.from("seguidores").upsert({ seguidor_id: user.id, seguindo_id: profile.id });
      if (followError) throw followError;

      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function unfollowUser(profileId: string) {
    if (!user || !hasWriteAccess()) return;
    setBusyMessage("Atualizando seguidores...");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("seguidores").delete().eq("seguidor_id", user.id).eq("seguindo_id", profileId);
      if (error) throw error;
      await refreshData(user.id);
    } catch (error: any) {
      setErrorMessage(readableDbError(error?.message));
    } finally {
      setBusyMessage("");
    }
  }

  async function sendMessage(friendId: string, body: string) {
    if (!user || !body.trim() || !hasWriteAccess()) return;
    setBusyMessage("Enviando mensagem...");
    setErrorMessage("");

    try {
      const { error } = await supabase.from("mensagens").insert({
        remetente_id: user.id,
        destinatario_id: friendId,
        conteudo: body.trim(),
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
    if (!hasWriteAccess()) return;
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
          await assertSchemaReady();
          const profiledUser = await loadCurrentUser(nextUser);
          setUser(profiledUser);
          await refreshData(profiledUser.id);
          setView("app");
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
            readOnly={user?.accessType === "convidado"}
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
                readOnly={user?.accessType === "convidado"}
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
                <EventsScreen parties={filteredParties} onCreate={() => openCreateForm()} onSelect={setSelectedPartyId} readOnly={user?.accessType === "convidado"} />
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
                readOnly={user?.accessType === "convidado"}
              />
            )}
            {tab === "my-parties" && (
              <MyPartiesScreen
                parties={parties.filter((party) => party.isOwner)}
                onCreate={() => openCreateForm()}
                onEdit={(party) => openCreateForm(party)}
                onSelect={setSelectedPartyId}
                onRemoveAttendee={removePartyAttendee}
                readOnly={user?.accessType === "convidado"}
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
                readOnly={user?.accessType === "convidado"}
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

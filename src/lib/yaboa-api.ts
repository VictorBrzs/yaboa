import { supabase } from "./supabase";

type ApiOptions = {
  token?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export type Venue = {
  id: string;
  name: string;
  type: "bar" | "nightclub" | "show" | "party" | "urban" | string;
  lat: number;
  lng: number;
  address: string;
  description: string;
  image_url?: string | null;
  tags: string[];
  created_by?: string | null;
  created_at?: string;
};

export type VenuePopularity = {
  venue_id?: string;
  checkins_last_1h: number;
  checkins_last_24h: number;
  avg_stay_minutes?: number;
  popularity_score: number;
  status: "bombando" | "lotado" | "vale a pena" | "tranquilo" | "fechado" | string;
  updated_at?: string;
};

export type EventItem = {
  id: string;
  venue_id?: string | null;
  created_by?: string | null;
  title: string;
  description: string;
  image_url?: string | null;
  event_date: string;
  event_time: string;
  price_range: string;
  category: string;
  tags: string[];
  max_attendees?: number | null;
  promoted: boolean;
  created_at?: string;
  attendees_count?: number;
};

export type GroupItem = {
  id: string;
  name: string;
  description?: string;
  avatar_emoji: string;
  created_by?: string | null;
  next_plan?: {
    venue_id?: string;
    label?: string;
    date?: string;
    time?: string;
  };
  created_at?: string;
  members_count?: number;
};

export type Profile = {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatar_url?: string | null;
  bio?: string | null;
  preferences?: {
    types: string[];
    tags: string[];
  };
};

type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  created_at: string;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const body = (options.body ?? {}) as any;
  const url = new URL(path, "https://supabase.yaboa");
  const parts = url.pathname.split("/").filter(Boolean);
  const userId = await getCurrentUserId();

  if (!userId && requiresAuth(url.pathname, method)) {
    throw new Error("Sessao obrigatoria para continuar.");
  }

  if (url.pathname === "/profiles" && method === "GET") {
    let query = supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (userId) query = query.neq("id", userId);
    const { data, error } = await query;
    if (error) throw error;
    return { profiles: data ?? [] } as T;
  }

  if (parts[0] === "profile" && parts[1] && method === "GET") {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", parts[1]).single();
    if (error) throw error;
    return { profile: data } as T;
  }

  if (url.pathname === "/profile" && method === "PUT") {
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        name: body.name,
        email: body.email,
        username: body.username,
        bio: body.bio,
        avatar_url: body.avatar_url,
        preferences: body.preferences,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { profile: data } as T;
  }

  if (url.pathname === "/venues" && method === "GET") {
    const q = url.searchParams.get("q");
    let query = supabase.from("venues").select("*").order("created_at", { ascending: false });
    if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    return { venues: data ?? [] } as T;
  }

  if (url.pathname === "/venues" && method === "POST") {
    const { data, error } = await supabase
      .from("venues")
      .insert({
        name: body.name,
        type: body.type,
        lat: Number(body.lat),
        lng: Number(body.lng),
        address: body.address,
        description: body.description,
        image_url: body.image_url ?? null,
        tags: tagsFrom(body.tags),
        created_by: userId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { venue: data } as T;
  }

  if (parts[0] === "venues" && parts[1] && parts[2] === "checkins" && method === "GET") {
    const { data, error } = await supabase
      .from("check_ins")
      .select("*")
      .eq("venue_id", parts[1])
      .gt("expires_at", new Date().toISOString())
      .eq("status", "public")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { checkins: data ?? [] } as T;
  }

  if (parts[0] === "venues" && parts[1] && method === "GET") {
    const [{ data: venue, error: venueError }, { data: checkins, error: checkinsError }] = await Promise.all([
      supabase.from("venues").select("*").eq("id", parts[1]).single(),
      supabase.from("check_ins").select("*").eq("venue_id", parts[1]).gt("expires_at", new Date().toISOString()),
    ]);
    if (venueError) throw venueError;
    if (checkinsError) throw checkinsError;
    return { venue, popularity: calculatePopularity(parts[1], checkins ?? []) } as T;
  }

  if (parts[0] === "venues" && parts[1] && method === "PUT") {
    const payload = removeUndefined({
      name: body.name,
      type: body.type,
      lat: body.lat === undefined ? undefined : Number(body.lat),
      lng: body.lng === undefined ? undefined : Number(body.lng),
      address: body.address,
      description: body.description,
      image_url: body.image_url,
      tags: body.tags === undefined ? undefined : tagsFrom(body.tags),
    });
    const { data, error } = await supabase.from("venues").update(payload).eq("id", parts[1]).select("*").single();
    if (error) throw error;
    return { venue: data } as T;
  }

  if (parts[0] === "venues" && parts[1] && method === "DELETE") {
    const { error } = await supabase.from("venues").delete().eq("id", parts[1]);
    if (error) throw error;
    return { success: true } as T;
  }

  if (url.pathname === "/checkins" && method === "GET") {
    let query = supabase.from("check_ins").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
    const queryUserId = url.searchParams.get("user_id");
    const venueId = url.searchParams.get("venue_id");
    if (queryUserId) query = query.eq("user_id", queryUserId);
    if (venueId) query = query.eq("venue_id", venueId);
    const { data, error } = await query;
    if (error) throw error;
    return { checkins: data ?? [] } as T;
  }

  if (url.pathname === "/checkins" && method === "POST") {
    const { data, error } = await supabase
      .from("check_ins")
      .insert({
        user_id: userId,
        venue_id: body.venue_id,
        status: body.status ?? "public",
        venue_status: body.venue_status ?? "vale a pena",
        expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { checkin: data } as T;
  }

  if (url.pathname === "/events" && method === "GET") {
    const [{ data: events, error: eventsError }, { data: attendees, error: attendeesError }] = await Promise.all([
      supabase
        .from("events")
        .select("*")
        .not("created_by", "is", null)
        .eq("category", "party")
        .order("event_date", { ascending: true }),
      supabase.from("event_attendees").select("event_id"),
    ]);
    if (eventsError) throw eventsError;
    if (attendeesError) throw attendeesError;
    return {
      events: (events ?? []).map((event) => ({
        ...event,
        attendees_count: (attendees ?? []).filter((attendee) => attendee.event_id === event.id).length,
      })),
    } as T;
  }

  if (url.pathname === "/events" && method === "POST") {
    const { data, error } = await supabase
      .from("events")
      .insert({
        venue_id: body.venue_id || null,
        created_by: userId,
        title: body.title,
        description: body.description,
        image_url: body.image_url ?? null,
        event_date: body.event_date,
        event_time: body.event_time,
        price_range: body.price_range,
        category: "party",
        tags: tagsFrom(body.tags),
        max_attendees: body.max_attendees ? Number(body.max_attendees) : null,
        promoted: Boolean(body.promoted),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { event: data } as T;
  }

  if (parts[0] === "events" && parts[1] && parts[2] === "rsvp" && method === "POST") {
    const { error } = await supabase.from("event_attendees").upsert({ event_id: parts[1], user_id: userId });
    if (error) throw error;
    return { success: true } as T;
  }

  if (parts[0] === "events" && parts[1] && method === "PUT") {
    const payload = removeUndefined({
      venue_id: body.venue_id || null,
      title: body.title,
      description: body.description,
      image_url: body.image_url,
      event_date: body.event_date,
      event_time: body.event_time,
      price_range: body.price_range,
      category: "party",
      tags: body.tags === undefined ? undefined : tagsFrom(body.tags),
      max_attendees: body.max_attendees ? Number(body.max_attendees) : null,
      promoted: body.promoted,
    });
    const { data, error } = await supabase.from("events").update(payload).eq("id", parts[1]).select("*").single();
    if (error) throw error;
    return { event: data } as T;
  }

  if (parts[0] === "events" && parts[1] && method === "DELETE") {
    const { error } = await supabase.from("events").delete().eq("id", parts[1]);
    if (error) throw error;
    return { success: true } as T;
  }

  if (url.pathname === "/follows" && method === "GET") {
    const { data, error } = await supabase
      .from("follows")
      .select("*")
      .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return { follows: (data ?? []) as Follow[] } as T;
  }

  if (url.pathname === "/follows" && method === "POST") {
    const { data, error } = await supabase
      .from("follows")
      .upsert({ follower_id: userId, following_id: body.following_id })
      .select("*")
      .single();
    if (error) throw error;
    return { follow: data as Follow } as T;
  }

  if (parts[0] === "follows" && parts[1] && method === "DELETE") {
    const { error } = await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", parts[1]);
    if (error) throw error;
    return { success: true } as T;
  }

  if (url.pathname === "/chat/messages" && method === "GET") {
    const otherId = url.searchParams.get("friend_id");
    let query = supabase
      .from("chat_messages")
      .select("*")
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order("created_at", { ascending: true });
    if (otherId) query = query.or(`and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`);
    const { data, error } = await query;
    if (error) throw error;
    return { messages: (data ?? []) as ChatMessage[] } as T;
  }

  if (url.pathname === "/chat/messages" && method === "POST") {
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ sender_id: userId, receiver_id: body.receiver_id, body: body.body })
      .select("*")
      .single();
    if (error) throw error;
    return { message: data as ChatMessage } as T;
  }

  if (url.pathname === "/groups" && method === "GET") {
    const [{ data: groups, error: groupsError }, { data: members, error: membersError }] = await Promise.all([
      supabase.from("groups").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("group_id"),
    ]);
    if (groupsError) throw groupsError;
    if (membersError) throw membersError;
    return {
      groups: (groups ?? []).map((group) => ({
        ...group,
        members_count: (members ?? []).filter((member) => member.group_id === group.id).length,
      })),
    } as T;
  }

  if (url.pathname === "/groups" && method === "POST") {
    const { data, error } = await supabase
      .from("groups")
      .insert({ name: body.name, description: body.description, avatar_emoji: body.avatar_emoji ?? "YA", created_by: userId, next_plan: body.next_plan })
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("group_members").insert({ group_id: data.id, user_id: userId, role: "admin" });
    return { group: { ...data, members_count: 1 } } as T;
  }

  if (parts[0] === "groups" && parts[1] && method === "PUT") {
    const payload = removeUndefined({ name: body.name, description: body.description, avatar_emoji: body.avatar_emoji, next_plan: body.next_plan });
    const { data, error } = await supabase.from("groups").update(payload).eq("id", parts[1]).select("*").single();
    if (error) throw error;
    return { group: data } as T;
  }

  if (parts[0] === "groups" && parts[1] && method === "DELETE") {
    const { error } = await supabase.from("groups").delete().eq("id", parts[1]);
    if (error) throw error;
    return { success: true } as T;
  }

  throw new Error("Rota nao implementada.");
}

async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

function requiresAuth(pathname: string, method: ApiOptions["method"]) {
  if (method !== "GET") return true;
  return ["/follows", "/chat/messages"].includes(pathname);
}

function calculatePopularity(venueId: string, checkins: any[]): VenuePopularity {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const checkinsLastHour = checkins.filter((checkin) => new Date(checkin.created_at).getTime() > oneHourAgo).length;
  const checkinsLastDay = checkins.filter((checkin) => new Date(checkin.created_at).getTime() > oneDayAgo).length;
  let status = "tranquilo";
  if (checkinsLastHour >= 10) status = "bombando";
  else if (checkinsLastHour >= 3) status = "lotado";
  else if (checkinsLastHour >= 1) status = "vale a pena";

  return {
    venue_id: venueId,
    checkins_last_1h: checkinsLastHour,
    checkins_last_24h: checkinsLastDay,
    avg_stay_minutes: 240,
    popularity_score: Math.min(100, checkinsLastHour * 20 + checkinsLastDay * 4),
    status,
    updated_at: new Date().toISOString(),
  };
}

function removeUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function tagsFrom(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

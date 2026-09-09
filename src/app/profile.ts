import { supabase } from "../lib/supabase";
import type { CurrentUser } from "./types";

export function userFromSupabase(user: any): CurrentUser {
  const fallbackUsername = user.email?.split("@")[0] || "yaboa";
  const username = normalizeUsername(user.user_metadata?.username || fallbackUsername);
  const role: CurrentUser["role"] =
    user.user_metadata?.role === "convidado" || user.user_metadata?.perfil_tipo === "convidado" || user.email === "visitante@yaboa.app"
      ? "convidado"
      : "usuario";

  return {
    id: user.id,
    name: user.user_metadata?.name || username || "Yaboa",
    email: user.email || "",
    username,
    avatarUrl: "",
    bio: "",
    favoriteTags: ["pop", "samba"],
    role,
    isGuest: role === "convidado",
  };
}

export async function ensureProfile(user: CurrentUser) {
  if (user.isGuest) return;

  const { data: existing, error: lookupError } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (lookupError) {
    console.warn("Profile lookup skipped:", lookupError.message);
    return;
  }
  if (existing) return;

  const usernameBase = user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username || `${usernameBase}_${user.id.slice(0, 6)}`,
    preferences: { types: ["party", "bar"], tags: ["pop", "samba"] },
  });

  if (error) console.warn("Profile sync skipped:", error.message);
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 24) || "yaboa";
}

export function userFromProfile(user: CurrentUser, profile: any): CurrentUser {
  const preferences = profile?.preferences && typeof profile.preferences === "object" ? profile.preferences : {};
  const favoriteTags = Array.isArray(preferences.tags) ? preferences.tags.filter(Boolean) : user.favoriteTags;
  const role = profile?.tipo_perfil === "convidado" || profile?.role === "convidado" ? "convidado" : user.role;

  return {
    ...user,
    name: profile?.name || user.name,
    username: profile?.username || user.username,
    avatarUrl: profile?.avatar_url || user.avatarUrl,
    bio: profile?.bio || user.bio,
    favoriteTags,
    role,
    isGuest: role === "convidado",
  };
}

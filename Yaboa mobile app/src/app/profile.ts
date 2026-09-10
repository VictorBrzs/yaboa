import { supabase } from "../lib/supabase";
import type { CurrentUser } from "./types";

export function userFromSupabase(user: any): CurrentUser {
  const fallbackUsername = user.email?.split("@")[0] || "yaboa";
  const username = normalizeUsername(user.user_metadata?.username || fallbackUsername);
  return {
    id: user.id,
    name: user.user_metadata?.nome || user.user_metadata?.name || username || "Yaboa",
    email: user.email || "",
    username: normalizeUsername(user.user_metadata?.nome_usuario || username),
    accessType: "membro",
    avatarUrl: "",
    bio: "",
    favoriteTags: ["pop", "samba"],
  };
}

export async function ensureProfile(user: CurrentUser) {
  const { data: existing, error: lookupError } = await supabase.from("usuarios").select("id").eq("id", user.id).maybeSingle();
  if (lookupError) {
    console.warn("Profile lookup skipped:", lookupError.message);
    return;
  }
  if (existing) return;

  const usernameBase = user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
  const { error } = await supabase.from("usuarios").insert({
    id: user.id,
    nome: user.name,
    email: user.email,
    nome_usuario: user.username || `${usernameBase}_${user.id.slice(0, 6)}`,
    preferencias: { tipos: ["festa", "bar"], etiquetas: ["pop", "samba"] },
  });

  if (error) console.warn("Profile sync skipped:", error.message);
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 24) || "yaboa";
}

export function userFromProfile(user: CurrentUser, profile: any): CurrentUser {
  const preferences = profile?.preferencias && typeof profile.preferencias === "object" ? profile.preferencias : {};
  const favoriteTags = Array.isArray(preferences.etiquetas) ? preferences.etiquetas.filter(Boolean) : user.favoriteTags;

  return {
    ...user,
    name: profile?.nome || user.name,
    username: profile?.nome_usuario || user.username,
    accessType: profile?.tipo_acesso || user.accessType,
    avatarUrl: profile?.url_avatar || user.avatarUrl,
    bio: profile?.biografia || user.bio,
    favoriteTags,
  };
}

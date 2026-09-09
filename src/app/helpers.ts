export function readableAuthError(message = "") {
  if (message.includes("Invalid login")) return "Credenciais invalidas. Confira nome de usuario e senha.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("rate limit")) return "Muitas tentativas agora. Tente novamente em alguns minutos.";
  return message || "Nao foi possivel autenticar agora.";
}

export function readableDbError(message = "") {
  if (message.includes("visibility")) return "Nao foi possivel carregar as festas agora.";
  if (message.includes("row-level security")) return "Permissao negada. Entre novamente e tente de novo.";
  if (message.includes("violates foreign key")) return "Perfil do usuario ainda nao existe. Saia, entre novamente e tente de novo.";
  if (message.includes("duplicate key") || message.includes("profiles_username_key")) return "Esse username ja esta em uso. Escolha outro.";
  return message || "Nao foi possivel salvar agora.";
}

export function formatDate(value: string) {
  if (!value) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `ha ${minutes} min`;
  return `ha ${Math.round(minutes / 60)} h`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadius = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

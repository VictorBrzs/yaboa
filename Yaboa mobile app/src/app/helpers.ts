export function readableAuthError(message = "") {
  if (message.includes("Invalid login")) return "Credenciais inválidas. Confira e-mail e senha.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("User already registered")) return "Este e-mail já possui uma conta. Use a opção Entrar.";
  if (message.includes("Password should")) return "A senha não atende aos requisitos de segurança.";
  if (message.includes("rate limit")) return "Muitas tentativas agora. Tente novamente em alguns minutos.";
  return message || "Não foi possível autenticar agora.";
}

export function readableDbError(message = "") {
  if (message.includes("visibility") || message.includes("visibilidade")) return "Não foi possível carregar as festas agora.";
  if (message.includes("row-level security")) return "Permissão negada. Entre novamente e tente de novo.";
  if (message.includes("violates foreign key")) return "O perfil do usuário ainda não existe. Saia, entre novamente e tente de novo.";
  if (message.includes("duplicate key") || message.includes("usuarios_nome_usuario_key")) return "Esse nome de usuário já está em uso. Escolha outro.";
  return message || "Não foi possível salvar agora.";
}

export function formatDate(value: string) {
  if (!value) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export function relativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  return `há ${Math.round(minutes / 60)} h`;
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

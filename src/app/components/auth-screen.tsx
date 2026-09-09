import { FormEvent, useState } from "react";
import { RefreshCw } from "lucide-react";
import yaboaLogo from "../../assets/brand/yaboa-cropped.png";
import { supabase } from "../../lib/supabase";
import { readableAuthError } from "../helpers";
import { ensureProfile, userFromSupabase } from "../profile";
import type { AppStatus, CurrentUser } from "../types";
import { Field } from "./common";

type AuthScreenProps = {
  appStatus: AppStatus;
  busyMessage: string;
  errorMessage: string;
  onAuthenticated: (user: CurrentUser) => void;
  onRetry: () => void;
};

export function AuthScreen({ appStatus, busyMessage, errorMessage, onAuthenticated, onRetry }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInGuest() {
    const guestUser = {
      id: "guest-user",
      name: "Visitante",
      email: "visitante@yaboa.app",
      username: "visitante",
      avatarUrl: "",
      bio: "Visualização apenas.",
      favoriteTags: ["pop", "samba"],
      role: "convidado" as const,
      isGuest: true,
    };

    setLoading(true);
    setMessage("");

    try {
      onAuthenticated(guestUser);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const cleanUsername = normalizeUsername(username);
        if (cleanUsername.length < 3) throw new Error("Escolha um username com pelo menos 3 caracteres.");

        const { data: existingUsername, error: usernameError } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", cleanUsername)
          .maybeSingle();
        if (usernameError) throw usernameError;
        if (existingUsername) throw new Error("Esse username ja esta em uso.");

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name || cleanUsername, username: cleanUsername } },
        });
        if (error) throw error;

        if (!data.session?.user) {
          setMessage("Conta criada. Confirme no e-mail e depois entre pelo login.");
          return;
        }

        const user = { ...userFromSupabase(data.session.user), name: name || cleanUsername, username: cleanUsername };
        await ensureProfile(user);
        onAuthenticated(user);
        return;
      }

      const resolvedEmail = await resolveLoginEmail(loginId);
      const { data, error } = await supabase.auth.signInWithPassword({ email: resolvedEmail, password });
      if (error) throw error;
      if (!data.user) throw new Error("Login sem usuario retornado.");

      const user = userFromSupabase(data.user);
      await ensureProfile(user);
      onAuthenticated(user);
    } catch (error: any) {
      setMessage(readableAuthError(error?.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <main className="phone-frame auth-frame">
        <section className="auth-hero">
          <img className="brand-logo" src={yaboaLogo} alt="Yaboa" />
        </section>

        <form className="auth-panel" onSubmit={submit}>
          <div className="segmented">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Login
            </button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
              Cadastro
            </button>
          </div>

          {mode === "signup" && <Field label="Nome" value={name} onChange={setName} />}
          {mode === "signup" && (
            <Field
              label="Nome de usuario"
              value={username}
              onChange={(value) => setUsername(normalizeUsername(value))}
              required
            />
          )}
          {mode === "login" ? (
            <Field
              label="Nome de usuario"
              value={loginId}
              onChange={(value) => setLoginId(normalizeUsername(value))}
              required
            />
          ) : (
            <Field label="Email" value={email} onChange={setEmail} type="email" required />
          )}
          <Field label="Senha" value={password} onChange={setPassword} type="password" required />

          {(message || errorMessage) && <p className="form-message">{message || errorMessage}</p>}

          <button className="primary-button" disabled={loading || appStatus !== "ready"}>
            {loading ? "Conectando..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          <button type="button" className="ghost-button" onClick={signInGuest} disabled={loading || appStatus !== "ready"}>
            Entrar como convidado
          </button>

          {appStatus === "setup-error" && (
            <button className="ghost-button" type="button" onClick={onRetry}>
              <RefreshCw size={16} /> Tentar novamente
            </button>
          )}
        </form>
      </main>
    </div>
  );
}

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

async function resolveLoginEmail(loginId: string) {
  const value = loginId.trim();
  if (value.includes("@") && value.includes(".")) throw new Error("Entre apenas com seu username, sem e-mail.");

  const username = normalizeUsername(value);
  const { data, error } = await supabase.from("profiles").select("email").eq("username", username).maybeSingle();
  if (error) throw error;
  if (!data?.email) throw new Error("Nome de usuario nao encontrado. Confira o @usuario cadastrado.");
  return data.email;
}

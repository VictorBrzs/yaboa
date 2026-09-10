import { FormEvent, useState } from "react";
import { RefreshCw } from "lucide-react";
import yaboaLogo from "../../assets/brand/yaboa-cropped.png";
import { supabase } from "../../lib/supabase";
import { readableAuthError } from "../helpers";
import { ensureProfile, userFromSupabase } from "../profile";
import type { AppStatus, CurrentUser } from "../types";
import { Field } from "./common";

const contaConvidado = {
  email: import.meta.env.VITE_YABOA_GUEST_EMAIL || "convidado@yaboa.app",
  senha: import.meta.env.VITE_YABOA_GUEST_PASSWORD || "Convidado@Yaboa2026",
};

type AuthScreenProps = {
  appStatus: AppStatus;
  busyMessage: string;
  errorMessage: string;
  onAuthenticated: (user: CurrentUser) => Promise<void> | void;
  onRetry: () => void;
};

export function AuthScreen({ appStatus, busyMessage, errorMessage, onAuthenticated, onRetry }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function authenticate(emailToUse: string, passwordToUse: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: emailToUse, password: passwordToUse });
    if (error) throw error;
    if (!data.user) throw new Error("Login sem usuário retornado.");

    const user = userFromSupabase(data.user);
    await ensureProfile(user);
    await onAuthenticated(user);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      if (mode === "signup") {
        const cleanUsername = normalizeUsername(username);
        const cleanEmail = email.trim().toLowerCase();
        if (cleanUsername.length < 3) throw new Error("Escolha um nome de usuário com pelo menos 3 caracteres.");
        if (!cleanEmail) throw new Error("Informe seu e-mail.");
        if (password.length < 8) throw new Error("Crie uma senha com pelo menos 8 caracteres.");

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              nome: name.trim() || cleanUsername,
              nome_usuario: cleanUsername,
            },
          },
        });
        if (error) throw error;

        if (!data.session?.user) {
          setMessage("Conta criada. Confirme o e-mail para entrar.");
          return;
        }

        const user = { ...userFromSupabase(data.session.user), name: name.trim() || cleanUsername, username: cleanUsername };
        await ensureProfile(user);
        await onAuthenticated(user);
        return;
      }

      await authenticate(email.trim().toLowerCase(), password);
    } catch (error: any) {
      setMessage(readableAuthError(error?.message));
    } finally {
      setLoading(false);
    }
  }

  async function enterAsGuest() {
    setLoading(true);
    setMessage("");

    try {
      await authenticate(contaConvidado.email, contaConvidado.senha);
    } catch (error: any) {
      if (error?.message?.includes("Invalid login")) {
        setMessage("A conta de convidado ainda não foi criada no Supabase. Execute o comando criar:convidado uma vez.");
      } else {
        setMessage(readableAuthError(error?.message));
      }
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
              Entrar
            </button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
              Cadastro
            </button>
          </div>

          {mode === "signup" && <Field label="Nome" value={name} onChange={setName} autoComplete="name" maxLength={80} />}
          {mode === "signup" && (
            <Field
              label="Nome de usuário"
              value={username}
              onChange={(value) => setUsername(normalizeUsername(value))}
              autoComplete="username"
              required
            />
          )}
          <Field label="E-mail" value={email} onChange={setEmail} type="email" autoComplete="email" required />
          <Field
            label="Senha"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />

          {(message || errorMessage) && <p className="form-message">{message || errorMessage}</p>}

          <button className="primary-button" disabled={loading || appStatus !== "ready"}>
            {loading ? "Conectando..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>

          {mode === "login" && (
            <button className="ghost-button" type="button" onClick={enterAsGuest} disabled={loading || appStatus !== "ready"}>
              Entrar como convidado
            </button>
          )}

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

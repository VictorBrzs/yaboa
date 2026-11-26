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
  onAuthenticated: (user: CurrentUser) => Promise<void> | void;
  onRetry: () => void;
};

export function AuthScreen({ appStatus, busyMessage, errorMessage, onAuthenticated, onRetry }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const age = birthDate ? calculateAge(birthDate) : null;
  const cpfComplete = cpf.replace(/\D/g, "").length === 11;

  function changeMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setMessage("");
    if (nextMode === "login") {
      setCpf("");
      setBirthDate("");
    }
  }

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
        if (!isValidCpf(cpf)) throw new Error("Confira o CPF informado.");
        if (!birthDate || calculateAge(birthDate) === null) throw new Error("Informe uma data de nascimento válida.");

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

  return (
    <div className="app-shell">
      <main className="phone-frame auth-frame">
        <section className="auth-hero">
          <img className="brand-logo" src={yaboaLogo} alt="Yaboa" />
        </section>

        <form className="auth-panel" onSubmit={submit}>
          <div className="segmented" role="group" aria-label="Tipo de acesso">
            <button type="button" className={mode === "login" ? "active" : ""} aria-pressed={mode === "login"} onClick={() => changeMode("login")}>
              Entrar
            </button>
            <button type="button" className={mode === "signup" ? "active" : ""} aria-pressed={mode === "signup"} onClick={() => changeMode("signup")}>
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
          {mode === "signup" && (
            <>
              <Field
                label="CPF"
                value={cpf}
                onChange={(value) => setCpf(formatCpf(value))}
                placeholder="000.000.000-00"
                autoComplete="off"
                inputMode="numeric"
                maxLength={14}
                required
              />
              {cpfComplete && (
                <p className="age-check-note" role="status">
                  {isValidCpf(cpf) ? "Dígitos do CPF válidos." : "Confira os dígitos do CPF."}
                </p>
              )}
              <Field
                label="Data de nascimento"
                value={birthDate}
                onChange={setBirthDate}
                type="date"
                autoComplete="bday"
                required
              />
              {birthDate && age !== null && (
                <p className="age-check-note">
                  Idade informada: {age} anos. Menores também podem criar conta.
                </p>
              )}
              <p className="age-check-disclaimer">
                O app confere apenas os dígitos do CPF e usa a data informada para calcular a idade. Não confirma a titularidade do CPF. CPF e data de nascimento não serão salvos.
              </p>
            </>
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

          {(message || errorMessage) && <p className="form-message" role="alert" aria-live="polite">{message || errorMessage}</p>}
          {busyMessage && appStatus === "checking" && <p className="auth-status" role="status">{busyMessage}</p>}

          <button className="primary-button" disabled={loading || appStatus !== "ready"}>
            {loading ? "Conectando..." : mode === "login" ? "Entrar" : "Criar conta"}
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

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function isValidCpf(value: string) {
  const cpfDigits = value.replace(/\D/g, "");
  if (cpfDigits.length !== 11 || /^([0-9])\1{10}$/.test(cpfDigits)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpfDigits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(cpfDigits[9]) && calculateDigit(10) === Number(cpfDigits[10]);
}

function calculateAge(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const today = new Date();
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || birth > today) return null;

  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age;
}

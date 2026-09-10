import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emailConvidado = process.env.YABOA_GUEST_EMAIL || "convidado@yaboa.app";
const senhaConvidado = process.env.YABOA_GUEST_PASSWORD || "Convidado@Yaboa2026";

if (!url || !chaveServico) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env antes de executar este script.");
}

const supabase = createClient(url, chaveServico, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function encontrarUsuarioPorEmail(email) {
  let pagina = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;

    const usuario = data.users.find((item) => item.email?.toLowerCase() === email.toLowerCase());
    if (usuario || data.users.length < 1000) return usuario;
    pagina += 1;
  }
}

const metadados = { nome: "Convidado", nome_usuario: "convidado" };
const existente = await encontrarUsuarioPorEmail(emailConvidado);

const { data, error } = existente
  ? await supabase.auth.admin.updateUserById(existente.id, {
      password: senhaConvidado,
      email_confirm: true,
      user_metadata: metadados,
    })
  : await supabase.auth.admin.createUser({
      email: emailConvidado,
      password: senhaConvidado,
      email_confirm: true,
      user_metadata: metadados,
    });

if (error || !data.user) throw error || new Error("Não foi possível criar a conta de convidado.");

const { error: erroPerfil } = await supabase.from("usuarios").upsert(
  {
    id: data.user.id,
    nome: "Convidado",
    nome_usuario: "convidado",
    email: emailConvidado,
    tipo_acesso: "convidado",
  },
  { onConflict: "id" },
);
if (erroPerfil) throw erroPerfil;

console.log(`Conta de convidado pronta: ${emailConvidado}`);

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY;
const emailConvidado = process.env.YABOA_GUEST_EMAIL || "convidado@yaboa.app";
const senhaConvidado = process.env.YABOA_GUEST_PASSWORD || "Convidado@Yaboa2026";

if (!url || !chaveServico) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar este script.");
}

const supabase = createClient(url, chaveServico, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listarUsuarios() {
  const usuarios = [];
  let pagina = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) throw error;

    usuarios.push(...data.users);
    if (data.users.length < 1000) return usuarios;
    pagina += 1;
  }
}

const usuariosAtuais = await listarUsuarios();
for (const usuario of usuariosAtuais) {
  const { error } = await supabase.auth.admin.deleteUser(usuario.id);
  if (error) throw error;
}

const { data: contaConvidado, error: erroConvidado } = await supabase.auth.admin.createUser({
  email: emailConvidado,
  password: senhaConvidado,
  email_confirm: true,
  user_metadata: {
    nome: "Convidado",
    nome_usuario: "convidado",
  },
});
if (erroConvidado || !contaConvidado.user) throw erroConvidado || new Error("Nao foi possivel criar a conta de convidado.");

const { error: erroPerfil } = await supabase.from("usuarios").upsert({
  id: contaConvidado.user.id,
  nome: "Convidado",
  nome_usuario: "convidado",
  email: emailConvidado,
  tipo_acesso: "convidado",
}, { onConflict: "id" });
if (erroPerfil) throw erroPerfil;

console.log(`Banco de usuarios limpo. Conta de convidado criada: ${emailConvidado}`);

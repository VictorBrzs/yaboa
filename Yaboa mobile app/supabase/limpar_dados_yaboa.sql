-- Limpa os dados publicos do Yaboa sem apagar usuarios do Supabase Auth.
-- Rode no SQL Editor do Supabase quando quiser zerar festas, presencas,
-- seguidores, mensagens e perfis publicos do app.
--
-- Se quiser preservar perfis de usuario, remova "usuarios" do TRUNCATE.

truncate table
  public.mensagens,
  public.presencas,
  public.participantes_eventos,
  public.eventos,
  public.locais,
  public.seguidores,
  public.usuarios
restart identity cascade;

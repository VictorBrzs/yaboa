
# Yaboa

Aplicativo social para encontrar, publicar e acompanhar festas e locais.

## Executar localmente

```bash
npm install
npm run dev
```

## Preparar o Supabase do zero

O processo abaixo remove todos os dados públicos do Yaboa e todas as contas de autenticação do projeto. Faça um backup no painel do Supabase antes de executá-lo se houver algo a preservar.

1. No SQL Editor do Supabase, execute [supabase/reorganizar_banco_portugues.sql](supabase/reorganizar_banco_portugues.sql). Ele reconstrói as tabelas, índices, gatilhos e políticas RLS em português.
2. Crie um arquivo `.env` a partir de `.env.example` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. A chave `service_role` nunca deve começar com `VITE_` e nunca deve ser publicada.
3. Execute `npm run redefinir:usuarios`. O script remove os usuários existentes de Auth e cria a conta somente leitura `convidado@yaboa.app`.
4. Para usar a mesma conta no navegador, mantenha os valores `VITE_YABOA_GUEST_EMAIL` e `VITE_YABOA_GUEST_PASSWORD` iguais aos valores `YABOA_GUEST_EMAIL` e `YABOA_GUEST_PASSWORD` usados pelo script administrativo.

O convidado pode navegar pelo mapa, eventos e perfis públicos. As políticas do banco e os controles da interface bloqueiam qualquer cadastro, edição, presença, seguimento ou mensagem.
  

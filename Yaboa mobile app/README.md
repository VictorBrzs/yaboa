# Yaboa

Aplicativo social para encontrar, publicar e acompanhar festas e locais.

## Executar localmente

```bash
npm install
npm run dev
```

## Aplicativos Android e iOS

O app usa React com Ionic e Capacitor. Para sincronizar o projeto nativo com a versão web compilada:

```bash
npm run build
npx cap sync
```

No Android, abra `android/` no Android Studio ou gere um APK de depuração com `npm run android:apk`.

Para iOS, execute `npm run ios:sync` e abra o projeto com `npm run ios:open`. A compilação e assinatura para dispositivo iOS exigem macOS com Xcode instalado.

Também há comandos equivalentes na raiz do repositório, como `npm run build:app`, `npm run android:sync` e `npm run ios:sync`.

## Variaveis de ambiente

Crie um arquivo `.env` a partir de `.env.example` e preencha as variaveis publicas do Supabase usadas pelo navegador. Tudo que começa com `VITE_` é incluído no aplicativo e deve ser tratado como público. Nunca coloque senhas de usuário, `service_role` ou segredos de servidor nessas variáveis.

O cliente usa apenas a chave pública do Supabase. Proteja leitura e escrita com Row Level Security (RLS) e políticas no banco; os controles da interface não substituem essas políticas.

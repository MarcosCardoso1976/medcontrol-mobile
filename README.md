# MedControl Mobile

App de lembrete de remédios em **React Native + Expo (SDK 58)**. Recria o app web (`app-remedios`) como aplicativo nativo,
com o mesmo visual, o **mesmo banco (Neon, incluindo a base da Anvisa)** e — o principal — **alarmes que tocam no horário
com o app fechado e a tela bloqueada**, como o despertador do celular.

- 💊 Remédios por período (madrugada/manhã/tarde/noite), vários horários, anotações, "Diário" e "Dias de tratamento"
- 📦 Estoque em unidades, em volume (ml/g/gotas) e por dosagem de canetas (Victoza, Saxenda, Olire) + agulhas
- 🔔 Alarmes **locais** no sistema (sem servidor, sem internet): 15 min antes, no horário e lembretes de atraso
- 📴 **Offline-first**: tudo funciona sem internet e sincroniza depois (SQLite + fila de envio)
- 🔎 Autocomplete de medicamentos da Anvisa
- 🌗 Tema claro/escuro com as mesmas cores do app web

## ✅ O que foi verificado e o que falta

| Verificado aqui (automatizado) | Resultado |
|---|---|
| Testes (`npm test`): domínio, plano de alarmes, agendador, SQLite + outbox, sincronização com servidor fake, store, telas | **144 passando** |
| TypeScript estrito (`npm run typecheck`) | sem erros |
| ESLint (`npm run lint`) | sem erros nem avisos |
| Bundle Metro/Hermes Android **e** iOS (`expo export`) | compila |
| `expo prebuild` Android e iOS (config plugins, permissões, som e ícone de notificação) | gera os projetos nativos |
| `expo-doctor` | 18/20 (as 2 falhas são só de rede do ambiente de teste) |

| **Não** foi possível verificar aqui | O que fazer |
|---|---|
| Rodar dentro do **Expo Go** (modo compatível testado só por teste automatizado, sem o app real) | abra no Expo Go e me avise se algo quebrar |
| Rodar em celular/emulador e **ouvir o alarme tocar** | siga o roteiro "Testar o alarme" abaixo |
| Compilar o app nativo (Gradle/Xcode) | o primeiro `eas build` faz isso na nuvem |
| Funcionamento em Xiaomi/Samsung/etc. com economia de bateria | faça o passo a passo dentro do app (Configurações → Alarmes) |
| O patch do backend contra o banco real | ver `backend-patch/APLICAR.md` |

## Requisitos

- Node 20+ (testado com 22) e npm
- Conta gratuita na [Expo](https://expo.dev) (para o build na nuvem) **ou** Android Studio (build local)
- 📱 **Expo Go**: roda só para *ver as telas e o fluxo* (veja a seção abaixo). Para alarmes de verdade use o *development build*.

## Começando

```bash
npm install
cp .env.example .env        # edite EXPO_PUBLIC_API_URL com a URL da sua API (Vercel)
```

### 1) (Recomendado) Aplique o patch de segurança no backend
Veja [`backend-patch/APLICAR.md`](backend-patch/APLICAR.md). Leva 2 minutos e corrige falhas do backend atual.

### 2) Gere o app de desenvolvimento

**Na nuvem (mais simples, não precisa instalar Android Studio):**
```bash
npx eas-cli login
npx eas-cli build --platform android --profile development   # gera um .apk; baixe e instale no celular
```
Antes, troque `https://SEU-APP.vercel.app` em `eas.json` pela URL real da sua API.

**Local (precisa do Android Studio + celular com depuração USB):**
```bash
npx expo run:android
```

### 3) Rode
```bash
npx expo start --dev-client
```
Abra o app instalado no celular e conecte pelo QR code.

## Rodar no Expo Go (só para ver o app)

```bash
npm install
cp .env.example .env     # opcional: sem a URL da API o app funciona offline
npx expo start           # escaneie o QR code com o app Expo Go (Android) ou a Câmera (iOS)
```

Instale o **Expo Go atualizado** na loja (precisa suportar o SDK 58) e deixe celular e computador na **mesma rede Wi‑Fi**
(se não conectar, use `npx expo start --tunnel`).

**O que funciona:** todas as telas, cadastro de remédios, marcar doses, estoque, histórico, listas, tema, banco local,
sincronização com a API e notificações locais simples.

**O que NÃO é confiável no Expo Go** (limitações do próprio Expo Go, não do app):
- alarme com o app **fechado**/tela bloqueada, horário exato (`setAlarmClock`) e som personalizado `alarm.wav`;
- tarefa em segundo plano que renova os alarmes;
- permissões personalizadas (alarme exato, bateria).

O app detecta o Expo Go, desativa esses recursos para não quebrar e mostra um aviso em *Configurações → Alarmes*.
Para testar o alarme de verdade, use o development build.

## Testar o alarme (faça isto primeiro!)

1. Abra o app → **Configurações** → **Alarmes** e conclua o passo a passo (notificações, *Alarmes e lembretes*, bateria).
2. Toque em **"Testar em 10 s"**, **feche o app** (arraste dos recentes) e **bloqueie a tela**.
3. Em ~10 s o alarme deve tocar, mesmo com a tela bloqueada. ✅
4. Cadastre um remédio para daqui a 2 minutos, feche o app e confirme que o aviso chega.
5. Em *Configurações → Diagnóstico de alarmes* você vê tudo o que está agendado.

> **Android**: dose e atrasos usam `setAlarmClock` (mesma entrega do despertador, não é adiada pela economia de bateria),
> desde que *Alarmes e lembretes* esteja permitido. Em Xiaomi/Samsung/Huawei/Oppo também libere o app nas configurações de bateria
> (o app mostra as instruções do seu fabricante).
> **iOS**: o sistema limita a 64 avisos agendados, então o app agenda as próximas doses e renova sempre que você o abre.
> Abra o app com frequência (há aviso quando a cobertura está acabando).

## Trazer os dados do app web (PWA)

1. Aplique o patch do backend e abra `https://SEU-APP.vercel.app/vinculo` no navegador onde você usa o PWA → **Copiar**.
2. No app: **Configurações → Código de vínculo → Usar outro código → Vincular**.

(Sem o patch: no console do navegador, `localStorage.getItem('app-remedios:device-id')`.)
O código funciona como uma senha — quem o tiver acessa os mesmos remédios.

## Estrutura

```
src/
├─ app/                  Telas (Expo Router): index (Home), alarme, configuracoes, _layout
├─ components/
│  ├─ home/              Calendário, lista, formulário, histórico, header de listas, splash, permissões…
│  └─ ui/                Botão, cartão, campo, chave, abas, diálogo/folha, toast, progresso…
├─ hooks/                Notificações → app (toque, ação "Tomei", alarme em primeiro plano)
├─ lib/
│  ├─ dominio/           Regras puras e testadas: períodos, estoque, tratamento, estatísticas, formulário, listas
│  ├─ alarmes/           plano (puro) · agendador · canais · permissões · tarefa em segundo plano
│  ├─ db/                SQLite local (migrações) + repositório + outbox
│  ├─ sync/              Motor de sincronização (push da outbox + pull)
│  ├─ api/               Cliente HTTP (header X-Device-Id, timeout, erros tipados)
│  └─ store.ts           Estado e ações do app
├─ theme/                Tokens de cor (claro/escuro), ThemeProvider
└─ types/remedio.ts      Tipos (idênticos ao app web)
__tests__/               144 testes (inclui SQLite real em memória e servidor de API fake)
backend-patch/           Patch de segurança do backend + página /vinculo do PWA
docs/DECISOES.md         Desvios do plano e decisões
```

## Scripts

| Comando | Faz |
|---|---|
| `npm start` / `npm run dev-client` | Metro |
| `npm test` | testes |
| `npm run typecheck` · `npm run lint` | tipos · ESLint |
| `npx expo-doctor` | diagnóstico do projeto |

## Solução de problemas

- **"Não toca no horário"**: confira *Configurações → Alarmes* (as três permissões) e a bateria do fabricante. Use o diagnóstico para ver se há avisos agendados.
- **Sincronização desativada**: faltou `EXPO_PUBLIC_API_URL` (no `.env` e no `eas.json`). O app segue funcionando offline.
- **"Alterações rejeitadas pelo servidor"** em Configurações: o servidor devolveu erro 4xx para algum item; *Tentar de novo* ou *Descartar*. Nada é apagado localmente.
- **Erro ao instalar/rodar no Expo Go**: use o development build (`eas build --profile development`).
- Depois de mudar `app.json`/plugins, gere um **novo build** (mudanças nativas não chegam por Fast Refresh).

## Publicação

Veja as fases 10–11 do plano: teste em aparelhos reais, política de privacidade (dados de saúde = LGPD), declaração de
**alarme exato** na Play Console, `eas build --profile production`.
O aplicativo é um lembrete e **não substitui orientação médica**.

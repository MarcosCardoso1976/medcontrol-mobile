# Patch de segurança do backend (projeto Next.js `app-remedios`)

O app móvel funciona com o backend atual, **mas o backend atual tem falhas de segurança** (veja abaixo) que ficam
expostas quando o app é publicado. Este patch corrige o essencial **sem mexer no banco** (nenhuma migração).

## O que muda

| Arquivo | Mudança |
|---|---|
| `src/lib/usuario-context.ts` | Valida o formato do `X-Device-Id` |
| `src/app/api/{listas,remedios,remedios-tomados}/route.ts` | Respondem **400** sem `X-Device-Id` (antes, `GET /api/remedios` sem o header devolvia os dados de **todos** os usuários) |
| `src/lib/repository.ts` → `salvarRemedio` | Só o dono atualiza um remédio (antes, qualquer um que soubesse o `id` sobrescrevia) |
| `src/lib/repository.ts` → `copiarLista` | Só copia listas do próprio usuário |
| `src/lib/repository.ts` → `criarLista` | Aceita `id` opcional e é **idempotente** (o app offline-first cria a lista com id próprio) |
| `src/app/vinculo/page.tsx` (novo) | Página do PWA que mostra/copia o **código de vínculo** para usar no app |

Erros de acesso viram **403**. A lista modelo (`GET /api/listas?disponiveis=true`) continua pública, como antes.

## Como aplicar

Na raiz do projeto `app-remedios` (a pasta que contém `src/`):

```bash
patch -p1 --dry-run < /caminho/para/medcontrol-backend-seguranca.patch   # só simula
patch -p1           < /caminho/para/medcontrol-backend-seguranca.patch   # aplica
```

Depois, `npm run build` (ou o que você usa) e faça o deploy na Vercel. O PWA continua funcionando: ele já envia
`X-Device-Id` em todas as chamadas.

> ⚠️ Este patch foi conferido por: aplicação em cópia limpa do seu código e checagem de sintaxe TypeScript.
> **Não foi executado contra o banco** (o pacote enviado não incluía `node_modules` nem as credenciais).
> Teste no PWA e no app depois do deploy.

## Sem o patch?

O app continua funcionando: se o servidor ignorar o `id` da lista, o app troca o id local pelo id devolvido
(há teste automatizado cobrindo isso). Mas a falha de acesso entre usuários segue aberta.

## Código de vínculo

Depois do deploy, abra `https://SEU-APP.vercel.app/vinculo` **no mesmo navegador/PWA** em que você já usa o app,
toque em *Copiar*, e no app novo vá em *Configurações → Código de vínculo → Usar outro código → Vincular*.
Seus remédios e histórico aparecem no app. (Alternativa sem o patch: no console do navegador,
`localStorage.getItem('app-remedios:device-id')`.)

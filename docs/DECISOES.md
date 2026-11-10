# Decisões e desvios em relação ao plano

O plano (`PLANO-RECRIACAO-REACT-NATIVE-MEDCONTROL.md`) foi seguido fase a fase. Onde a realidade (versões novas,
risco de erros de build) pediu outra escolha, ela está registrada aqui.

## Versões (todas as mais recentes na data da criação, via `expo install`)

Expo **SDK 58** · React Native **0.88** · React **19.3** · Expo Router · TypeScript **6** · `expo-notifications` 58 ·
`expo-sqlite`, `expo-secure-store`, `expo-background-task`, `@react-native-community/datetimepicker` 9.

## Desvios (e por quê)

| Plano | Implementado | Motivo |
|---|---|---|
| NativeWind | `StyleSheet` + tokens de tema (`src/theme/tokens.ts`) | NativeWind v4 depende de Reanimated/Babel e é a maior fonte de erros de build em SDKs novos. O visual é o mesmo (mesmas cores, raios, bordas de 1,5 px, fontes). |
| `@gorhom/bottom-sheet`, `sonner-native`, Reanimated, `lucide-react-native` | `Modal` nativo (`Folha`/`Dialogo`), toast próprio, `Animated` do RN, ícones Feather (`@expo/vector-icons`) | Menos dependências nativas = menos risco. Nenhuma lib exige configuração extra. |
| pnpm | npm | Funciona sem configuração extra com o Metro/Expo. |
| `zod` | validação manual em funções puras (`src/lib/dominio/formulario.ts`), 100% testada | uma dependência a menos. |
| Colunas `sync_estado` no SQLite | "pendente" = existe linha na `outbox`; listas têm a flag `remoto` | modelo mais simples e sem estados divergentes. Itens **descartados** (4xx) continuam na outbox e ficam protegidos do *pull* (não há perda silenciosa). |
| Cor de fundo escuro `#081F18` (seção 9.3 do plano) | **`#000B05`** (token real do `globals.css`) | `#081F18` era o `themeColor`/header; o `background` do tema é o token oklch convertido. Header, abas, diálogos, calendário e botão "+" usam os hex fixos do web. |
| Alarme "nível 1" + "nível 2 opcional" | **Dose e atrasos já usam `delivery: 'alarmClock'`** (Android) | O `expo-notifications` 58 expõe `setAlarmClock()` nativamente (documentado para "despertadores e lembretes de remédio"). Sem módulo nativo próprio. Pré-aviso usa `bestEffort`. Requer a permissão `SCHEDULE_EXACT_ALARM` (o app pede). |
| Ação "Adiar 10 min" | **não incluída** | Não é confiável com o app morto sem tarefa dedicada; a ação "✅ Tomei" abre o app e marca. |
| iOS Time Sensitive / AlarmKit | **não incluídos** | O entitlement Time Sensitive pode quebrar o build do EAS sem a capability habilitada; AlarmKit exige módulo nativo de terceiros ainda imaturo. No iOS os avisos são notificações comuns com som próprio. Backlog. |
| Atalho de app "Adicionar Remédio" | deep link `medcontrol://?action=add` | Atalhos estáticos exigem módulo extra. |
| Aplicar mudanças no `/api/sync` (B7) | *pull* completo (3 GETs) | A API atual não tem o endpoint; para o volume de dados de um app de remédios é suficiente. |
| Copiar lista via API | copiar **localmente** (e enfileirar) | funciona offline. |

## Melhorias conscientes sobre o app web

- **Dias de tratamento** decrementam pela **diferença de dias** desde a última abertura (o web decrementava só 1).
- **Lembretes**: pré-aviso (15 min antes), **aviso no horário exato** (o cron do web nunca avisava no horário) e 3 lembretes de atraso (+10, +25, +40 min), cancelados ao marcar a dose. Preferências em Configurações.
- **Estoque** em volume mostra a unidade (ml/g/gotas) no alerta.
- Validação do formulário com mensagens **inline** (o web usava `alert()`).
- **Segurança**: o app nunca fala direto com o banco; `backend-patch/` corrige as falhas do backend atual.

## Semântica inferida do web (confirmar com o produto)

- Em cada período, **"Diário"** e **"Dias de tratamento"** são exclusivos. Períodos sem nenhum dos dois são contínuos.
- `diasDeTratamento` limita o **agendamento de alarmes** (só dos períodos que não são "Diário").
- A lista "ativa" e o tema ficam salvos no SQLite local (`meta`).

## Alarmes: regras do plano

- Janela rolante: **14 dias** (limite de 300 avisos no Android; **60 no iOS**, onde o limite do sistema é 64).
  As **doses principais têm prioridade**; pré-aviso/atrasos só entram se sobrar orçamento.
- O plano é uma **função pura** (`src/lib/alarmes/plano.ts`) reaplicada por diferença (`agendador.ts`): reaplicar não duplica.
- Replanejamento: ao abrir/voltar ao app, a cada mudança de dados, ao marcar dose, após sincronizar, ao mudar preferências
  e numa tarefa em segundo plano (~12 h, a critério do SO).

import { AppState } from 'react-native';
import type { HorarioRemedio, ListaRemedios, Periodo, Remedio, RemedioTomado } from '@/types/remedio';
import { api, apiConfigurada } from '@/lib/api/client';
import { cancelarDose } from '@/lib/alarmes/agendador';
import { carregarPreferencias, replanejar } from '@/lib/alarmes';
import {
  getMeta,
  limparTomadosLocal,
  obterListas,
  obterRemedios,
  obterTomados,
  removerListaLocal,
  removerRemedioLocal,
  removerTomadoLocal,
  resetarDadosLocais,
  salvarListaLocal,
  salvarRemedioLocal,
  salvarTomadoLocal,
  setMeta,
  type ListaLocal,
} from '@/lib/db/repo';
import { definirDeviceId, obterDeviceId } from '@/lib/device-id';
import { aplicarAlteracaoEstoque, type AlertaEstoque } from '@/lib/dominio/estoque';
import { processarDia } from '@/lib/dominio/tratamento';
import { generateId } from '@/lib/ids';
import { criarStore, useStore } from '@/lib/mini-store';
import { carregarUltimaSync, registrarAoMudarDados, sincronizar } from '@/lib/sync/engine';
import { agoraISO, getLocalDateString } from '@/lib/utils';

export interface EstadoApp {
  pronto: boolean;
  erroInicial: string | null;
  listas: ListaLocal[];
  listaAtivaId: string | null;
  remedios: Remedio[];
  tomados: RemedioTomado[];
  alertaEstoque: { remedio: Remedio; alerta: AlertaEstoque } | null;
  deviceId: string | null;
  /** muda quando a data local vira (para recalcular pendentes etc.) */
  hoje: string;
}

export const appStore = criarStore<EstadoApp>({
  pronto: false,
  erroInicial: null,
  listas: [],
  listaAtivaId: null,
  remedios: [],
  tomados: [],
  alertaEstoque: null,
  deviceId: null,
  hoje: getLocalDateString(),
});

export const useApp = <S,>(sel: (e: EstadoApp) => S) => useStore(appStore, sel);

const CHAVE_LISTA_ATIVA = 'lista_ativa';

// ───────────── carga ─────────────
export async function recarregar(): Promise<void> {
  const [listas, remedios, tomados] = await Promise.all([obterListas(), obterRemedios(), obterTomados()]);
  let ativa = appStore.get().listaAtivaId ?? (await getMeta(CHAVE_LISTA_ATIVA));
  if (!ativa || !listas.some((l) => l.id === ativa)) ativa = listas[0]?.id ?? null;
  if (ativa && ativa !== (await getMeta(CHAVE_LISTA_ATIVA))) await setMeta(CHAVE_LISTA_ATIVA, ativa);
  appStore.set({ listas, remedios, tomados, listaAtivaId: ativa, hoje: getLocalDateString() });
}

async function aposMutacao(opts: { sync?: boolean } = {}) {
  await recarregar();
  void replanejar();
  if (opts.sync !== false) void sincronizar();
}

// ───────────── inicialização ─────────────
let iniciando: Promise<void> | null = null;
export function iniciar(): Promise<void> {
  if (!iniciando) iniciando = executarInicio();
  return iniciando;
}

async function executarInicio() {
  try {
    registrarAoMudarDados(async () => {
      await recarregar();
      void replanejar();
    });
    const deviceId = await obterDeviceId();
    appStore.set({ deviceId });
    await carregarPreferencias();
    await carregarUltimaSync();
    await recarregar();
    await garantirListaInicial();
    await processarDiaTodos();
    appStore.set({ pronto: true });
    void replanejar({ imediato: true });
    void sincronizar();
  } catch (e) {
    console.error('[store] falha na inicialização', e);
    appStore.set({ erroInicial: e instanceof Error ? e.message : String(e), pronto: true });
  }
}

/** Porta do `init()` do web: sem listas → adota lista modelo (online) ou cria "Geral". */
async function garantirListaInicial() {
  if (appStore.get().listas.length > 0) return;
  // Se já existe conta no servidor (ex.: vínculo/reinstalação), traz tudo antes de criar algo.
  if (apiConfigurada) {
    try {
      await sincronizar();
      await recarregar();
      if (appStore.get().listas.length > 0) return;
      const modelos = await api.listasModelo();
      if (Array.isArray(modelos) && modelos.length > 0) {
        const adotada = await api.adotarModelo(modelos[0].id);
        await sincronizar();
        await recarregar();
        if (appStore.get().listas.some((l) => l.id === adotada.id)) return;
      }
    } catch {
      /* offline: segue para a lista local */
    }
  }
  if (appStore.get().listas.length === 0) {
    await salvarListaLocal({ id: generateId(), nome: 'Geral', criadaEm: agoraISO(), remoto: false });
    await recarregar();
  }
}

/** Decremento diário de dias de tratamento e recálculo de dosagem (uma vez por dia). */
async function processarDiaTodos() {
  const hoje = getLocalDateString();
  for (const r of appStore.get().remedios) {
    const res = processarDia(r, hoje);
    if (res.remover) {
      await removerRemedioLocal(r.id);
    } else if (res.alterado) {
      await salvarRemedioLocal({ ...res.remedio, atualizadoEm: agoraISO() });
    }
  }
  await recarregar();
}

// ───────────── remédios ─────────────
export async function salvarRemedio(r: Remedio): Promise<void> {
  await salvarRemedioLocal({ ...r, atualizadoEm: agoraISO() });
  await aposMutacao();
}

export async function alternarAtivo(id: string, ativo: boolean): Promise<void> {
  const r = appStore.get().remedios.find((x) => x.id === id);
  if (r) await salvarRemedio({ ...r, ativo });
}

export async function excluirRemedio(id: string): Promise<void> {
  await removerRemedioLocal(id);
  await aposMutacao();
}

/** Remove um período (horários dele). Sem horários restantes, remove o remédio todo. */
export async function removerPeriodo(id: string, periodo: Periodo): Promise<void> {
  const r = appStore.get().remedios.find((x) => x.id === id);
  if (!r) return;
  const horarios: HorarioRemedio[] = r.horarios.filter((h) => h.periodo !== periodo);
  if (horarios.length === 0) return excluirRemedio(id);
  await salvarRemedio({
    ...r,
    horarios,
    periodosDiarios: r.periodosDiarios?.filter((p) => p !== periodo),
  });
}

export function criarCopia(r: Remedio): Remedio {
  const agora = agoraISO();
  return {
    ...r,
    id: generateId(),
    nome: `Cópia de ${r.nome}`,
    horarios: r.horarios.map((h) => ({ ...h, id: generateId() })),
    criadoEm: agora,
    atualizadoEm: agora,
    quantidadeRestanteDosagem: r.quantidadeTotalDosagem,
    quantidadeRestanteAgulhas: r.quantidadeTotalAgulhas,
    ultimaDataDecrementoDosagem: undefined,
    ultimaDataDecrementoDiasTratamento: undefined,
  };
}

// ───────────── doses ─────────────
const mesmaDose = (t: RemedioTomado, remedioId: string, periodo: string, horario: string, data: string) =>
  t.remedioId === remedioId && t.periodo === periodo && t.horario === horario && t.data === data;

/**
 * Marca/desmarca uma dose. `alternar` desmarca se já estiver tomada; `marcar` apenas marca (botão "Tomei!").
 * Devolve 'marcado' | 'desmarcado' | 'ignorado'.
 */
export async function marcarTomado(
  remedioId: string,
  periodo: Periodo,
  horario: string,
  data: string = getLocalDateString(),
  modo: 'alternar' | 'marcar' = 'alternar',
): Promise<'marcado' | 'desmarcado' | 'ignorado'> {
  const { remedios, tomados, listaAtivaId } = appStore.get();
  const remedio = remedios.find((r) => r.id === remedioId);
  if (!remedio) return 'ignorado';
  const jaTomado = tomados.some((t) => mesmaDose(t, remedioId, periodo, horario, data));
  const hoje = getLocalDateString();

  if (modo === 'alternar' && jaTomado) {
    await removerTomadoLocal({ remedioId, periodo, horario, data });
    const outras = tomados.some(
      (t) => t.remedioId === remedioId && t.data === hoje && !mesmaDose(t, remedioId, periodo, horario, data),
    );
    const res = aplicarAlteracaoEstoque(remedio, true, hoje, outras);
    if (res.alterado) await salvarRemedioLocal({ ...res.remedio, atualizadoEm: agoraISO() });
    await aposMutacao();
    return 'desmarcado';
  }
  if (jaTomado) return 'ignorado';

  await salvarTomadoLocal({
    id: generateId(),
    listaId: remedio.listaId || listaAtivaId || '',
    remedioId,
    periodo,
    horario,
    data,
    tomadoEm: agoraISO(),
  });
  const res = aplicarAlteracaoEstoque(remedio, false, hoje, false);
  if (res.alterado) await salvarRemedioLocal({ ...res.remedio, atualizadoEm: agoraISO() });
  if (res.alerta) appStore.set({ alertaEstoque: { remedio: res.remedio, alerta: res.alerta } });
  // cancela na hora pré-aviso/atrasos/dose daquele dia, sem esperar o replanejamento
  void cancelarDose(remedioId, periodo, horario, data);
  await aposMutacao();
  return 'marcado';
}

export function fecharAlertaEstoque() {
  appStore.set({ alertaEstoque: null });
}

// ───────────── listas ─────────────
export async function definirListaAtiva(id: string): Promise<void> {
  await setMeta(CHAVE_LISTA_ATIVA, id);
  appStore.set({ listaAtivaId: id });
}

export async function criarLista(nome: string): Promise<ListaLocal> {
  const lista: ListaLocal = { id: generateId(), nome, criadaEm: agoraISO(), remoto: false };
  await salvarListaLocal(lista);
  await definirListaAtiva(lista.id);
  await aposMutacao();
  return lista;
}

export async function renomearLista(id: string, nome: string): Promise<void> {
  const l = appStore.get().listas.find((x) => x.id === id);
  if (!l) return;
  await salvarListaLocal({ ...l, nome });
  await aposMutacao();
}

export async function excluirLista(id: string): Promise<void> {
  const l = appStore.get().listas.find((x) => x.id === id);
  if (!l) return;
  await removerListaLocal(id, l.remoto);
  const { listaAtivaId } = appStore.get();
  if (listaAtivaId === id) appStore.set({ listaAtivaId: null });
  await recarregar();
  if (appStore.get().listas.length === 0) {
    await salvarListaLocal({ id: generateId(), nome: 'Geral', criadaEm: agoraISO(), remoto: false });
  }
  await aposMutacao();
}

/** Copia a lista (e seus remédios) localmente — funciona offline e sincroniza depois. */
export async function copiarLista(id: string): Promise<void> {
  const { listas, remedios } = appStore.get();
  const original = listas.find((l) => l.id === id);
  if (!original) return;
  const nova: ListaLocal = { id: generateId(), nome: `${original.nome} (cópia)`, criadaEm: agoraISO(), remoto: false };
  await salvarListaLocal(nova);
  for (const r of remedios.filter((x) => x.listaId === id)) {
    const agora = agoraISO();
    await salvarRemedioLocal({
      ...r,
      id: generateId(),
      listaId: nova.id,
      horarios: r.horarios.map((h) => ({ ...h, id: generateId() })),
      criadoEm: agora,
      atualizadoEm: agora,
    });
  }
  await aposMutacao();
}

// ───────────── histórico / dados ─────────────
export async function limparHistorico(): Promise<void> {
  await limparTomadosLocal();
  await aposMutacao();
}

/** Troca a identidade por um código vindo do PWA e baixa os dados dessa conta. */
export async function vincularCodigo(codigo: string): Promise<void> {
  await definirDeviceId(codigo.trim().toLowerCase());
  await resetarDadosLocais();
  await setMeta(CHAVE_LISTA_ATIVA, null);
  appStore.set({ deviceId: codigo.trim().toLowerCase(), listas: [], remedios: [], tomados: [], listaAtivaId: null });
  await sincronizar();
  await recarregar();
  await garantirListaInicial();
  await aposMutacao({ sync: false });
}

export async function sincronizarAgora(): Promise<void> {
  await sincronizar();
}

// Reage à volta ao primeiro plano: vira o dia, reabastece alarmes e sincroniza.
let ouvindoEstado = false;
export function observarPrimeiroPlano() {
  if (ouvindoEstado) return () => undefined;
  ouvindoEstado = true;
  let ultimoSync = Date.now();
  const sub = AppState.addEventListener('change', async (s) => {
    if (s !== 'active' || !appStore.get().pronto) return;
    const hojeAtual = getLocalDateString();
    if (hojeAtual !== appStore.get().hoje) await processarDiaTodos();
    else await recarregar();
    void replanejar({ imediato: true });
    if (Date.now() - ultimoSync > 60_000) {
      ultimoSync = Date.now();
      void sincronizar();
    }
  });
  return () => {
    sub.remove();
    ouvindoEstado = false;
  };
}

export type { ListaRemedios };

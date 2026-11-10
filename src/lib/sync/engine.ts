import { api, apiConfigurada, ApiError } from '@/lib/api/client';
import {
  descartarItemOutbox,
  existeOutboxAguardando,
  falharItemOutbox,
  getMeta,
  aplicarPull,
  marcarListaRemota,
  obterListas,
  proximoItemOutbox,
  remapearListaId,
  removerItemOutbox,
  resumoOutbox,
  setMeta,
  type ItemOutbox,
} from '@/lib/db/repo';
import type { Remedio, RemedioTomado } from '@/types/remedio';
import { statusSync } from './status';

type AoMudar = () => void | Promise<void>;
let aoMudarDados: AoMudar = () => undefined;
/** O store registra aqui o recarregamento da UI após um pull. */
export function registrarAoMudarDados(fn: AoMudar) {
  aoMudarDados = fn;
}

let emAndamento: Promise<void> | null = null;

/** Sincroniza (push da outbox + pull). Execuções simultâneas são unificadas. */
export function sincronizar(): Promise<void> {
  if (emAndamento) return emAndamento;
  emAndamento = executar().finally(() => {
    emAndamento = null;
  });
  return emAndamento;
}

async function atualizarContagens() {
  const r = await resumoOutbox();
  statusSync.set({ pendentes: r.pendentes, descartados: r.descartados });
  return r;
}

async function executar() {
  if (!apiConfigurada) {
    await atualizarContagens();
    statusSync.set({ estado: 'sem-api' });
    return;
  }
  statusSync.set({ estado: 'sincronizando' });
  try {
    const drenou = await drenar();
    if (drenou) {
      await puxar();
      const agora = Date.now();
      await setMeta('ultima_sync', String(agora));
      statusSync.set({ estado: 'ocioso', ultimaSync: agora, ultimoErro: null });
      await aoMudarDados();
    } else if (statusSync.get().estado === 'sincronizando') {
      statusSync.set({ estado: 'erro' });
    }
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError('rede', 0, e instanceof Error ? e.message : 'Erro desconhecido');
    statusSync.set({ estado: err.kind === 'rede' ? 'offline' : 'erro', ultimoErro: err.message });
  } finally {
    await atualizarContagens();
  }
}

/** Devolve true se a outbox ficou vazia (então é seguro puxar). */
async function drenar(): Promise<boolean> {
  for (let guarda = 0; guarda < 2000; guarda++) {
    const item = await proximoItemOutbox();
    if (!item) return !(await existeOutboxAguardando());
    try {
      await enviar(item);
      await removerItemOutbox(item.seq);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError('rede', 0, e instanceof Error ? e.message : 'Erro');
      if (err.kind === 'cliente') {
        // 4xx: não perder em silêncio — o item fica marcado como descartado (e continua protegido do pull)
        await descartarItemOutbox(item.seq, `${item.entidade}/${item.operacao}: ${err.message}`);
        continue;
      }
      const tentativas = item.tentativas + 1;
      const espera = Math.min(2 ** tentativas * 1000, 5 * 60_000);
      await falharItemOutbox(item.seq, tentativas, Date.now() + espera, err.message);
      statusSync.set({ estado: err.kind === 'rede' ? 'offline' : 'erro', ultimoErro: err.message });
      return false;
    }
  }
  return false;
}

async function enviar(item: ItemOutbox) {
  const payload = JSON.parse(item.payload) as Record<string, unknown>;
  switch (`${item.entidade}/${item.operacao}`) {
    case 'lista/upsert': {
      const listas = await obterListas();
      const local = listas.find((l) => l.id === item.chave);
      if (!local) return; // excluída localmente antes de sincronizar
      if (local.remoto) {
        await api.renomearLista(local.id, local.nome);
      } else {
        const criada = await api.criarLista(local.nome, local.id);
        if (criada.id !== local.id) await remapearListaId(local.id, criada.id);
        else await marcarListaRemota(local.id);
      }
      return;
    }
    case 'lista/delete':
      await api.excluirLista(String(payload.id));
      return;
    case 'remedio/upsert':
      await api.salvarRemedio(payload as unknown as Remedio);
      return;
    case 'remedio/delete':
      await api.excluirRemedio(String(payload.id));
      return;
    case 'tomado/upsert':
      await api.salvarTomado(payload as unknown as RemedioTomado);
      return;
    case 'tomado/delete':
      await api.excluirTomado(payload as { remedioId: string; periodo: string; horario: string; data: string });
      return;
    case 'historico/limpar':
      await api.limparHistorico();
      return;
    default:
      throw new ApiError('cliente', 0, `Operação desconhecida: ${item.entidade}/${item.operacao}`);
  }
}

async function puxar() {
  const [listas, remedios, tomados] = await Promise.all([api.listas(), api.remedios(), api.tomados()]);
  await aplicarPull({
    listas: Array.isArray(listas) ? listas : [],
    remedios: Array.isArray(remedios) ? remedios : [],
    tomados: Array.isArray(tomados) ? tomados : [],
  });
}

export async function carregarUltimaSync() {
  const v = await getMeta('ultima_sync');
  if (v) statusSync.set({ ultimaSync: Number(v) });
  await atualizarContagens();
}

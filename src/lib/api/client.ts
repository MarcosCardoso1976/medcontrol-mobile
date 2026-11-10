import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { ListaRemedios, Remedio, RemedioTomado } from '@/types/remedio';
import { obterDeviceId } from '@/lib/device-id';

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
export const apiConfigurada = BASE.length > 0;
export const URL_API = BASE;

const TIMEOUT_MS = 15_000;

export type TipoErroApi = 'rede' | 'servidor' | 'cliente';
export class ApiError extends Error {
  constructor(
    public kind: TipoErroApi,
    public status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ApiError';
  }
}

async function requisicao<T>(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  caminho: string,
  opcoes: { corpo?: unknown; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  if (!apiConfigurada) throw new ApiError('rede', 0, 'EXPO_PUBLIC_API_URL não configurada');
  const qs = Object.entries(opcoes.query ?? {})
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
  const url = `${BASE}${caminho}${qs ? `?${qs}` : ''}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: metodo,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': await obterDeviceId(),
        'X-App-Version': Constants.expoConfig?.version ?? '0',
        'X-Platform': Platform.OS,
      },
      body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    });
    const texto = await res.text();
    let json: unknown = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = (json as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      const retentavel = res.status >= 500 || res.status === 408 || res.status === 429;
      throw new ApiError(retentavel ? 'servidor' : 'cliente', res.status, msg);
    }
    return json as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError('rede', 0, e instanceof Error ? e.message : 'Falha de rede');
  } finally {
    clearTimeout(timer);
  }
}

export interface MedicamentoSugestao {
  nome: string;
  principioAtivo: string | null;
  laboratorio: string | null;
}

export const api = {
  listas: () => requisicao<ListaRemedios[]>('GET', '/api/listas'),
  listasModelo: () => requisicao<ListaRemedios[]>('GET', '/api/listas', { query: { disponiveis: 'true' } }),
  criarLista: (nome: string, id?: string) =>
    requisicao<ListaRemedios>('POST', '/api/listas', { corpo: id ? { nome, id } : { nome } }),
  adotarModelo: (id: string) =>
    requisicao<ListaRemedios>('POST', '/api/listas', { corpo: { nome: '', acao: 'adotar-modelo', id } }),
  renomearLista: (id: string, nome: string) => requisicao<{ success: boolean }>('PATCH', '/api/listas', { corpo: { id, nome } }),
  excluirLista: (id: string) => requisicao<{ success: boolean }>('DELETE', '/api/listas', { query: { id } }),

  remedios: () => requisicao<Remedio[]>('GET', '/api/remedios'),
  salvarRemedio: (r: Remedio) => requisicao<Remedio>('POST', '/api/remedios', { corpo: r }),
  excluirRemedio: (id: string) => requisicao<{ success: boolean }>('DELETE', '/api/remedios', { query: { id } }),

  tomados: () => requisicao<RemedioTomado[]>('GET', '/api/remedios-tomados'),
  salvarTomado: (t: RemedioTomado) => requisicao<{ success: boolean }>('POST', '/api/remedios-tomados', { corpo: t }),
  excluirTomado: (t: { remedioId: string; periodo: string; horario: string; data: string }) =>
    requisicao<{ success: boolean }>('DELETE', '/api/remedios-tomados', { query: { ...t } }),
  limparHistorico: () => requisicao<{ success: boolean }>('DELETE', '/api/remedios-tomados', { query: { todos: 'true' } }),

  buscarMedicamentos: (q: string, sinal?: AbortSignal) => buscar(q, sinal),
};

async function buscar(q: string, sinal?: AbortSignal): Promise<MedicamentoSugestao[]> {
  if (!apiConfigurada) return [];
  const res = await fetch(`${BASE}/api/medicamentos/buscar?q=${encodeURIComponent(q)}`, {
    signal: sinal,
    headers: { 'X-Device-Id': await obterDeviceId() },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as unknown;
  return Array.isArray(json) ? (json as MedicamentoSugestao[]) : [];
}

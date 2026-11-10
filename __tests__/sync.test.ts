import { remedio } from './fixtures';

jest.mock('expo-sqlite', () => {
  const { criarBancoMemoria } = require('./helpers/sqlite-shim');
  return { openDatabaseAsync: async () => criarBancoMemoria() };
});
jest.mock('@/lib/ids', () => ({ generateId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}));

import * as repo from '@/lib/db/repo';
import { sincronizar } from '@/lib/sync/engine';
import { statusSync } from '@/lib/sync/status';

type Falha = number | 'rede' | null;
interface Opcoes {
  honrarId?: boolean;
}

/** Servidor fake em memória que imita as rotas do app Next.js (incluindo a FK remedio → lista). */
function criarServidor({ honrarId = false }: Opcoes = {}) {
  const st = {
    listas: [] as { id: string; nome: string; criadaEm: string }[],
    remedios: [] as ReturnType<typeof remedio>[],
    tomados: [] as Record<string, string>[],
    n: 0,
    falhas: [] as Falha[],
    chamadas: [] as string[],
  };
  const resp = (status: number, corpo: unknown) => ({ ok: status < 400, status, text: async () => JSON.stringify(corpo) });
  const chave = (t: Record<string, string>) => `${t.remedioId}|${t.periodo}|${t.horario}|${t.data}`;

  const fetchFake = jest.fn(async (url: string, init: { method?: string; body?: string } = {}) => {
    const u = new URL(url);
    const metodo = init.method ?? 'GET';
    const rota = `${metodo} ${u.pathname}`;
    st.chamadas.push(rota);
    const falha = st.falhas.shift();
    if (falha === 'rede') throw new TypeError('Network request failed');
    if (typeof falha === 'number') return resp(falha, { error: 'falhou de propósito' });
    const corpo = init.body ? JSON.parse(init.body) : undefined;

    switch (rota) {
      case 'GET /api/listas':
        return resp(200, u.searchParams.get('disponiveis') ? [] : st.listas);
      case 'POST /api/listas': {
        const id = honrarId && corpo.id ? corpo.id : `srv-${++st.n}`;
        const l = { id, nome: corpo.nome, criadaEm: '2026-11-07T10:00:00.000Z' };
        st.listas.push(l);
        return resp(201, l);
      }
      case 'PATCH /api/listas': {
        const l = st.listas.find((x) => x.id === corpo.id);
        if (!l) return resp(404, { error: 'não encontrada' });
        l.nome = corpo.nome;
        return resp(200, { success: true });
      }
      case 'DELETE /api/listas': {
        const id = u.searchParams.get('id');
        st.listas = st.listas.filter((l) => l.id !== id);
        st.remedios = st.remedios.filter((r) => r.listaId !== id);
        return resp(200, { success: true });
      }
      case 'GET /api/remedios':
        return resp(200, st.remedios);
      case 'POST /api/remedios': {
        if (!st.listas.some((l) => l.id === corpo.listaId)) return resp(500, { error: 'FK: lista inexistente' });
        st.remedios = [...st.remedios.filter((r) => r.id !== corpo.id), corpo];
        return resp(201, corpo);
      }
      case 'DELETE /api/remedios':
        st.remedios = st.remedios.filter((r) => r.id !== u.searchParams.get('id'));
        return resp(200, { success: true });
      case 'GET /api/remedios-tomados':
        return resp(200, st.tomados);
      case 'POST /api/remedios-tomados':
        st.tomados = [...st.tomados.filter((t) => chave(t) !== chave(corpo)), corpo];
        return resp(201, { success: true });
      case 'DELETE /api/remedios-tomados': {
        if (u.searchParams.get('todos') === 'true') st.tomados = [];
        else {
          const k = ['remedioId', 'periodo', 'horario', 'data'].map((c) => u.searchParams.get(c)).join('|');
          st.tomados = st.tomados.filter((t) => chave(t) !== k);
        }
        return resp(200, { success: true });
      }
      default:
        return resp(404, { error: `rota desconhecida: ${rota}` });
    }
  });
  (globalThis as unknown as { fetch: unknown }).fetch = fetchFake;
  return st;
}

const agora = '2026-11-07T10:00:00.000Z';
const listaLocal = (id = 'loc-1'): repo.ListaLocal => ({ id, nome: 'Geral', criadaEm: agora, remoto: false });
const dose = (parcial = {}) => ({ remedioId: 'r1', periodo: 'manha' as const, horario: '08:00', data: '2026-11-07', tomadoEm: agora, ...parcial });

beforeEach(async () => {
  await repo.resetarDadosLocais();
  statusSync.set({ estado: 'ocioso', pendentes: 0, descartados: 0, ultimoErro: null, ultimaSync: null });
});

async function criarDadosOffline() {
  await repo.salvarListaLocal(listaLocal());
  await repo.salvarRemedioLocal(remedio({ id: 'r1', listaId: 'loc-1' }));
  await repo.salvarTomadoLocal(dose({ listaId: 'loc-1' }));
}

describe('push', () => {
  it('lista + remédio + dose criados offline sobem na ordem certa e o id da lista é remapeado', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    await sincronizar();

    expect(srv.listas).toHaveLength(1);
    expect(srv.listas[0].id).toBe('srv-1');
    expect(srv.remedios[0].listaId).toBe('srv-1'); // chegou com o id definitivo
    expect(srv.tomados).toHaveLength(1);

    const [l] = await repo.obterListas();
    expect(l).toMatchObject({ id: 'srv-1', remoto: true });
    expect((await repo.obterRemedios())[0].listaId).toBe('srv-1');
    expect((await repo.resumoOutbox()).pendentes).toBe(0);
    expect(statusSync.get()).toMatchObject({ estado: 'ocioso', pendentes: 0 });
    expect(srv.chamadas.slice(0, 3)).toEqual(['POST /api/listas', 'POST /api/remedios', 'POST /api/remedios-tomados']);
  });

  it('backend com suporte a id (patch): o id local é mantido', async () => {
    const srv = criarServidor({ honrarId: true });
    await criarDadosOffline();
    await sincronizar();
    expect(srv.listas[0].id).toBe('loc-1');
    expect((await repo.obterListas())[0]).toMatchObject({ id: 'loc-1', remoto: true });
  });

  it('é idempotente: sincronizar de novo não reenvia nada', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    await sincronizar();
    const antes = srv.chamadas.filter((c) => c.startsWith('POST') || c.startsWith('DELETE')).length;
    await sincronizar();
    const depois = srv.chamadas.filter((c) => c.startsWith('POST') || c.startsWith('DELETE')).length;
    expect(depois).toBe(antes);
  });

  it('renomear lista já sincronizada usa PATCH', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    await sincronizar();
    const [l] = await repo.obterListas();
    await repo.salvarListaLocal({ ...l, nome: 'Nova' });
    await sincronizar();
    expect(srv.chamadas).toContain('PATCH /api/listas');
    expect(srv.listas[0].nome).toBe('Nova');
  });

  it('excluir remédio e desmarcar dose chegam ao servidor', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    await sincronizar();
    await repo.removerTomadoLocal(dose());
    await repo.removerRemedioLocal('r1');
    await sincronizar();
    expect(srv.tomados).toHaveLength(0);
    expect(srv.remedios).toHaveLength(0);
  });

  it('limpar histórico', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    await sincronizar();
    await repo.limparTomadosLocal();
    await sincronizar();
    expect(srv.tomados).toHaveLength(0);
  });
});

describe('falhas', () => {
  it('sem rede: nada se perde, estado offline, e depois recupera', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    srv.falhas = ['rede'];
    await sincronizar();

    expect(statusSync.get().estado).toBe('offline');
    expect(statusSync.get().pendentes).toBe(3);
    expect(await repo.obterRemedios()).toHaveLength(1);
    expect(srv.listas).toHaveLength(0);

    await repo.reativarOutbox(); // zera o backoff, como se o tempo tivesse passado
    await sincronizar();
    expect(statusSync.get()).toMatchObject({ estado: 'ocioso', pendentes: 0 });
    expect(srv.remedios).toHaveLength(1);
  });

  it('5xx: mantém o item para tentar de novo e registra o erro', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    srv.falhas = [503];
    await sincronizar();
    expect(statusSync.get().estado).toBe('erro');
    const item = await repo.proximoItemOutbox(Date.now() + 10 * 60_000);
    expect(item?.tentativas).toBe(1);
    expect(await repo.obterListas()).toHaveLength(1);
  });

  it('4xx: o item é descartado COM aviso, os demais seguem e nada some localmente', async () => {
    const srv = criarServidor();
    await criarDadosOffline();
    srv.falhas = [null, 400]; // lista ok · remédio rejeitado
    await sincronizar();

    const resumo = await repo.resumoOutbox();
    expect(resumo.descartados).toBe(1);
    expect(resumo.ultimoErro).toContain('remedio/upsert');
    expect(srv.tomados).toHaveLength(1); // a dose seguiu
    expect(statusSync.get().descartados).toBe(1);
    expect(statusSync.get().estado).toBe('ocioso'); // o pull rodou…
    expect(await repo.obterRemedios()).toHaveLength(1); // …e não apagou o remédio rejeitado
  });
});

describe('pull', () => {
  it('traz dados criados em outro aparelho e propaga exclusões', async () => {
    const srv = criarServidor();
    srv.listas.push({ id: 'S1', nome: 'Da nuvem', criadaEm: agora });
    srv.remedios.push(remedio({ id: 'remoto', listaId: 'S1', nome: 'Remoto' }));
    srv.tomados.push(dose({ remedioId: 'remoto' }));
    await sincronizar();
    expect((await repo.obterRemedios())[0].nome).toBe('Remoto');
    expect(await repo.obterTomados()).toHaveLength(1);

    srv.remedios = [];
    srv.tomados = [];
    await sincronizar();
    expect(await repo.obterRemedios()).toHaveLength(0);
    expect(await repo.obterTomados()).toHaveLength(0);
  });

  it('só empurra o que está pendente antes de puxar (alteração local não é sobrescrita)', async () => {
    const srv = criarServidor();
    srv.listas.push({ id: 'S1', nome: 'Da nuvem', criadaEm: agora });
    srv.remedios.push(remedio({ id: 'x', listaId: 'S1', nome: 'Servidor' }));
    await sincronizar();
    const [r] = await repo.obterRemedios();
    await repo.salvarRemedioLocal({ ...r, nome: 'Editado offline' });
    await sincronizar();
    expect(srv.remedios[0].nome).toBe('Editado offline');
    expect((await repo.obterRemedios())[0].nome).toBe('Editado offline');
  });
});

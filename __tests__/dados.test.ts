import { remedio } from './fixtures';

jest.mock('expo-sqlite', () => {
  const { criarBancoMemoria } = require('./helpers/sqlite-shim');
  return { openDatabaseAsync: async () => criarBancoMemoria() };
});

import { getDb } from '@/lib/db/database';
import * as repo from '@/lib/db/repo';

const { aplicarPull } = repo;

const agora = '2026-11-07T10:00:00.000Z';
const lista = (id: string, nome = 'Geral', remoto = false): repo.ListaLocal => ({ id, nome, criadaEm: agora, remoto });
const tomado = (parcial = {}) => ({ remedioId: 'r1', periodo: 'manha' as const, horario: '08:00', data: '2026-11-07', tomadoEm: agora, ...parcial });

async function outbox() {
  const db = await getDb();
  return db.getAllAsync<repo.ItemOutbox>('SELECT * FROM outbox ORDER BY seq');
}

beforeEach(async () => {
  await repo.resetarDadosLocais();
});

describe('meta', () => {
  it('grava, lê e apaga', async () => {
    expect(await repo.getMeta('x')).toBeNull();
    await repo.setMeta('x', '1');
    expect(await repo.getMeta('x')).toBe('1');
    await repo.setMeta('x', null);
    expect(await repo.getMeta('x')).toBeNull();
  });
});

describe('outbox: coalescência e ordem', () => {
  it('upsert repetido do mesmo remédio atualiza no lugar (mesmo seq)', async () => {
    await repo.salvarRemedioLocal(remedio({ nome: 'A' }));
    const [primeiro] = await outbox();
    await repo.salvarRemedioLocal(remedio({ nome: 'B' }));
    const itens = await outbox();
    expect(itens).toHaveLength(1);
    expect(itens[0].seq).toBe(primeiro.seq);
    expect(JSON.parse(itens[0].payload).nome).toBe('B');
    expect((await repo.obterRemedios())[0].nome).toBe('B');
  });

  it('renomear lista pendente mantém a posição (lista continua antes do remédio)', async () => {
    await repo.salvarListaLocal(lista('L1', 'Geral'));
    await repo.salvarRemedioLocal(remedio({ listaId: 'L1' }));
    await repo.salvarListaLocal(lista('L1', 'Renomeada'));
    const itens = await outbox();
    expect(itens.map((i) => `${i.entidade}/${i.operacao}`)).toEqual(['lista/upsert', 'remedio/upsert']);
    expect(JSON.parse(itens[0].payload).nome).toBe('Renomeada');
  });

  it('excluir remédio cancela o upsert pendente e enfileira o delete', async () => {
    await repo.salvarRemedioLocal(remedio());
    await repo.removerRemedioLocal('r1');
    const itens = await outbox();
    expect(itens.map((i) => `${i.entidade}/${i.operacao}`)).toEqual(['remedio/delete']);
    expect(await repo.obterRemedios()).toHaveLength(0);
  });

  it('marcar e desmarcar dose', async () => {
    await repo.salvarTomadoLocal(tomado());
    expect(await repo.obterTomados()).toHaveLength(1);
    await repo.removerTomadoLocal(tomado());
    expect(await repo.obterTomados()).toHaveLength(0);
    expect((await outbox()).map((i) => `${i.entidade}/${i.operacao}`)).toEqual(['tomado/delete']);
  });

  it('limpar histórico remove tomados e pendências de tomado', async () => {
    await repo.salvarTomadoLocal(tomado());
    await repo.salvarTomadoLocal(tomado({ horario: '20:00' }));
    await repo.limparTomadosLocal();
    expect(await repo.obterTomados()).toHaveLength(0);
    expect((await outbox()).map((i) => `${i.entidade}/${i.operacao}`)).toEqual(['historico/limpar']);
  });

  it('descartar, reativar e resumir', async () => {
    await repo.salvarRemedioLocal(remedio());
    const [item] = await outbox();
    await repo.falharItemOutbox(item.seq, 2, Date.now() + 60_000, 'boom');
    expect(await repo.proximoItemOutbox()).toBeNull(); // em backoff
    await repo.descartarItemOutbox(item.seq, 'rejeitado');
    expect(await repo.resumoOutbox()).toMatchObject({ pendentes: 0, descartados: 1, ultimoErro: 'rejeitado' });
    await repo.reativarOutbox();
    expect((await repo.proximoItemOutbox())?.seq).toBe(item.seq);
    await repo.descartarItemOutbox(item.seq, 'x');
    await repo.limparDescartados();
    expect((await repo.resumoOutbox()).descartados).toBe(0);
  });
});

describe('listas', () => {
  it('excluir lista remove remédios, tomados e pendências; lista remota gera delete', async () => {
    await repo.salvarListaLocal(lista('L1', 'Geral', true), false);
    await repo.salvarRemedioLocal(remedio({ id: 'r1', listaId: 'L1' }));
    await repo.salvarTomadoLocal(tomado({ listaId: 'L1' }));
    await repo.removerListaLocal('L1', true);
    expect(await repo.obterListas()).toHaveLength(0);
    expect(await repo.obterRemedios()).toHaveLength(0);
    expect(await repo.obterTomados()).toHaveLength(0);
    expect((await outbox()).map((i) => `${i.entidade}/${i.operacao}`)).toEqual(['lista/delete']);
  });

  it('lista nunca sincronizada some sem chamar o servidor', async () => {
    await repo.salvarListaLocal(lista('L2'));
    await repo.removerListaLocal('L2', false);
    expect(await outbox()).toHaveLength(0);
  });

  it('remapear id local → id do servidor reescreve remédios, tomados e outbox', async () => {
    await repo.salvarListaLocal(lista('local-1'));
    await repo.salvarRemedioLocal(remedio({ id: 'r1', listaId: 'local-1' }));
    await repo.salvarTomadoLocal(tomado({ listaId: 'local-1' }));
    await repo.remapearListaId('local-1', 'srv-9');
    const [l] = await repo.obterListas();
    expect(l).toMatchObject({ id: 'srv-9', remoto: true });
    expect((await repo.obterRemedios())[0].listaId).toBe('srv-9');
    expect((await repo.obterTomados())[0].listaId).toBe('srv-9');
    const itens = await outbox();
    expect(itens.every((i) => !i.payload.includes('local-1'))).toBe(true);
    expect(itens.find((i) => i.entidade === 'lista')?.chave).toBe('srv-9');
    expect(JSON.parse(itens.find((i) => i.entidade === 'remedio')!.payload).listaId).toBe('srv-9');
  });
});

describe('aplicarPull', () => {
  const srvLista = { id: 'S1', nome: 'Servidor', criadaEm: agora };

  it('insere dados do servidor', async () => {
    await aplicarPull({
      listas: [srvLista],
      remedios: [remedio({ id: 'rs', listaId: 'S1' })],
      tomados: [tomado({ remedioId: 'rs' })],
    });
    expect(await repo.obterListas()).toHaveLength(1);
    expect((await repo.obterListas())[0].remoto).toBe(true);
    expect((await repo.obterRemedios())[0].id).toBe('rs');
    expect(await repo.obterTomados()).toHaveLength(1);
  });

  it('remove localmente o que sumiu do servidor (sem pendência)', async () => {
    await repo.salvarListaLocal(lista('S1', 'Antiga', true), false);
    await repo.salvarRemedioLocal(remedio({ id: 'velho', listaId: 'S1' }), false);
    await repo.salvarTomadoLocal(tomado({ remedioId: 'velho' }), false);
    await aplicarPull({ listas: [], remedios: [], tomados: [] });
    expect(await repo.obterListas()).toHaveLength(0);
    expect(await repo.obterRemedios()).toHaveLength(0);
    expect(await repo.obterTomados()).toHaveLength(0);
  });

  it('PROTEGE itens com pendência na outbox (não apaga, não sobrescreve)', async () => {
    await repo.salvarListaLocal(lista('local-L'));
    await repo.salvarRemedioLocal(remedio({ id: 'novo', nome: 'Local', listaId: 'local-L' }));
    await repo.salvarTomadoLocal(tomado({ remedioId: 'novo' }));
    await aplicarPull({
      listas: [],
      remedios: [remedio({ id: 'novo', nome: 'Servidor', listaId: 'local-L' })],
      tomados: [],
    });
    expect((await repo.obterListas())[0].id).toBe('local-L');
    expect((await repo.obterRemedios())[0].nome).toBe('Local');
    expect(await repo.obterTomados()).toHaveLength(1);
  });

  it('item descartado continua protegido (sem perda silenciosa)', async () => {
    await repo.salvarRemedioLocal(remedio({ id: 'rej' }));
    const [item] = await outbox();
    await repo.descartarItemOutbox(item.seq, 'rejeitado');
    await aplicarPull({ listas: [], remedios: [], tomados: [] });
    expect((await repo.obterRemedios()).map((r) => r.id)).toEqual(['rej']);
  });

  it('listas ainda não sincronizadas (remoto=0) não são apagadas', async () => {
    await repo.salvarListaLocal(lista('so-local'), false);
    await aplicarPull({ listas: [], remedios: [], tomados: [] });
    expect(await repo.obterListas()).toHaveLength(1);
  });

  it('servidor vence quando não há pendência', async () => {
    await repo.salvarRemedioLocal(remedio({ id: 'x', nome: 'Antigo' }), false);
    await aplicarPull({ listas: [], remedios: [remedio({ id: 'x', nome: 'Novo' })], tomados: [] });
    expect((await repo.obterRemedios())[0].nome).toBe('Novo');
  });
});

import { remedio } from './fixtures';

jest.mock('expo-sqlite', () => {
  const { criarBancoMemoria } = require('./helpers/sqlite-shim');
  return { openDatabaseAsync: async () => criarBancoMemoria() };
});
jest.mock('expo-secure-store', () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined }));
jest.mock('@/lib/ids', () => {
  let n = 0;
  return { generateId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});
jest.mock('@/lib/alarmes', () => ({ replanejar: jest.fn(async () => undefined), carregarPreferencias: jest.fn(async () => undefined) }));
jest.mock('@/lib/alarmes/agendador', () => ({ cancelarDose: jest.fn(async () => undefined) }));
jest.mock('@/lib/sync/engine', () => ({
  sincronizar: jest.fn(async () => undefined),
  registrarAoMudarDados: jest.fn(),
  carregarUltimaSync: jest.fn(async () => undefined),
}));
jest.mock('@/lib/api/client', () => ({ api: {}, apiConfigurada: false }));

type Store = typeof import('@/lib/store');
type Repo = typeof import('@/lib/db/repo');
type Agendador = typeof import('@/lib/alarmes/agendador');

/** Carrega a store com módulos novos e um banco vazio (isolamento entre testes). */
function carregar(): { s: Store; repo: Repo; ag: Agendador } {
  let s!: Store;
  let repo!: Repo;
  let ag!: Agendador;
  jest.isolateModules(() => {
    repo = require('@/lib/db/repo');
    s = require('@/lib/store');
    ag = require('@/lib/alarmes/agendador');
  });
  return { s, repo, ag };
}

const HOJE = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function iniciarComLista() {
  const ctx = carregar();
  await ctx.s.iniciar();
  const listaId = ctx.s.appStore.get().listaAtivaId as string;
  return { ...ctx, listaId };
}

describe('inicialização', () => {
  it('primeira execução cria a lista "Geral" e a deixa ativa', async () => {
    const { s } = carregar();
    await s.iniciar();
    const e = s.appStore.get();
    expect(e.pronto).toBe(true);
    expect(e.erroInicial).toBeNull();
    expect(e.listas.map((l) => l.nome)).toEqual(['Geral']);
    expect(e.listaAtivaId).toBe(e.listas[0].id);
    expect(e.deviceId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('remove remédios cujo tratamento terminou e decrementa os demais', async () => {
    const { s, repo } = carregar();
    await repo.salvarListaLocal({ id: 'L', nome: 'Geral', criadaEm: '2026-01-01T00:00:00.000Z', remoto: true }, false);
    await repo.salvarRemedioLocal(remedio({ id: 'acabou', listaId: 'L', diasDeTratamento: 1 }), false);
    await repo.salvarRemedioLocal(remedio({ id: 'segue', listaId: 'L', diasDeTratamento: 5 }), false);
    await repo.salvarRemedioLocal(remedio({ id: 'diario', listaId: 'L', diasDeTratamento: 1, periodosDiarios: ['manha'] }), false);
    await s.iniciar();
    const ids = s.appStore.get().remedios.map((r) => r.id).sort();
    expect(ids).toEqual(['diario', 'segue']);
    expect(s.appStore.get().remedios.find((r) => r.id === 'segue')?.diasDeTratamento).toBe(4);
  });
});

describe('marcar dose', () => {
  it('marca, baixa o estoque, alerta quando zera e cancela os lembretes da dose', async () => {
    const { s, ag, listaId } = await iniciarComLista();
    await s.salvarRemedio(remedio({ id: 'r1', listaId, estoque: true, quantidadeEstoque: 1, alertaEstoque: 3 }));

    const res = await s.marcarTomado('r1', 'manha', '08:00');
    expect(res).toBe('marcado');
    const e = s.appStore.get();
    expect(e.tomados).toHaveLength(1);
    expect(e.tomados[0]).toMatchObject({ remedioId: 'r1', data: HOJE(), horario: '08:00' });
    expect(e.remedios[0].quantidadeEstoque).toBe(0);
    expect(e.alertaEstoque?.alerta).toEqual({ tipo: 'zerado', quantidade: 0 });
    expect(ag.cancelarDose).toHaveBeenCalledWith('r1', 'manha', '08:00', HOJE());
  });

  it('desmarcar reverte o estoque', async () => {
    const { s, listaId } = await iniciarComLista();
    await s.salvarRemedio(remedio({ id: 'r1', listaId, estoque: true, quantidadeEstoque: 5 }));
    await s.marcarTomado('r1', 'manha', '08:00');
    expect(s.appStore.get().remedios[0].quantidadeEstoque).toBe(4);
    const res = await s.marcarTomado('r1', 'manha', '08:00');
    expect(res).toBe('desmarcado');
    expect(s.appStore.get().tomados).toHaveLength(0);
    expect(s.appStore.get().remedios[0].quantidadeEstoque).toBe(5);
  });

  it('modo "marcar" nunca desmarca (botão Tomei! do alarme)', async () => {
    const { s, listaId } = await iniciarComLista();
    await s.salvarRemedio(remedio({ id: 'r1', listaId, estoque: true, quantidadeEstoque: 5 }));
    expect(await s.marcarTomado('r1', 'manha', '08:00', undefined, 'marcar')).toBe('marcado');
    expect(await s.marcarTomado('r1', 'manha', '08:00', undefined, 'marcar')).toBe('ignorado');
    expect(s.appStore.get().remedios[0].quantidadeEstoque).toBe(4); // só baixou uma vez
  });

  it('dosagem: baixa 1x por dia e só reverte quando não resta outra dose tomada', async () => {
    const { s, listaId } = await iniciarComLista();
    await s.salvarRemedio(
      remedio({
        id: 'r1', listaId,
        horarios: [{ id: 'a', periodo: 'manha', horario: '08:00' }, { id: 'b', periodo: 'noite', horario: '20:00' }],
        estoqueDosagem: true, tipoMedicamentoDosagem: 'victoza', dosagemDiaria: 1.2,
        quantidadeTotalDosagem: 36, quantidadeRestanteDosagem: 36,
      }),
    );
    await s.marcarTomado('r1', 'manha', '08:00');
    await s.marcarTomado('r1', 'noite', '20:00');
    expect(s.appStore.get().remedios[0].quantidadeRestanteDosagem).toBeCloseTo(34.8);

    await s.marcarTomado('r1', 'noite', '20:00'); // desmarca a 2ª; a 1ª continua tomada
    expect(s.appStore.get().remedios[0].quantidadeRestanteDosagem).toBeCloseTo(34.8);

    await s.marcarTomado('r1', 'manha', '08:00'); // desmarca a última → reverte
    expect(s.appStore.get().remedios[0].quantidadeRestanteDosagem).toBeCloseTo(36);
  });

  it('remédio inexistente é ignorado', async () => {
    const { s } = await iniciarComLista();
    expect(await s.marcarTomado('nao-existe', 'manha', '08:00')).toBe('ignorado');
  });
});

describe('remédios', () => {
  it('remover o último período remove o remédio inteiro', async () => {
    const { s, listaId } = await iniciarComLista();
    await s.salvarRemedio(
      remedio({ id: 'r1', listaId, horarios: [{ id: 'a', periodo: 'manha', horario: '08:00' }, { id: 'b', periodo: 'noite', horario: '20:00' }], periodosDiarios: ['noite'] }),
    );
    await s.removerPeriodo('r1', 'noite');
    expect(s.appStore.get().remedios[0].horarios).toHaveLength(1);
    expect(s.appStore.get().remedios[0].periodosDiarios).toEqual([]);
    await s.removerPeriodo('r1', 'manha');
    expect(s.appStore.get().remedios).toHaveLength(0);
  });

  it('inativar mantém o remédio e criarCopia gera ids novos', async () => {
    const { s, listaId } = await iniciarComLista();
    const original = remedio({ id: 'r1', listaId, estoqueDosagem: true, quantidadeTotalDosagem: 36, quantidadeRestanteDosagem: 10, ultimaDataDecrementoDosagem: '2026-01-01' });
    await s.salvarRemedio(original);
    await s.alternarAtivo('r1', false);
    expect(s.appStore.get().remedios[0].ativo).toBe(false);
    const copia = s.criarCopia(original);
    expect(copia.id).not.toBe(original.id);
    expect(copia.horarios[0].id).not.toBe(original.horarios[0].id);
    expect(copia.nome).toBe('Cópia de Dipirona');
    expect(copia.quantidadeRestanteDosagem).toBe(36);
    expect(copia.ultimaDataDecrementoDosagem).toBeUndefined();
  });
});

describe('listas', () => {
  it('criar torna ativa; copiar duplica remédios com novos ids', async () => {
    const { s, listaId } = await iniciarComLista();
    await s.salvarRemedio(remedio({ id: 'r1', listaId }));
    await s.copiarLista(listaId);
    const e = s.appStore.get();
    expect(e.listas).toHaveLength(2);
    const copia = e.listas.find((l) => l.nome === 'Geral (cópia)');
    expect(copia).toBeDefined();
    const doCopia = e.remedios.filter((r) => r.listaId === copia?.id);
    expect(doCopia).toHaveLength(1);
    expect(doCopia[0].id).not.toBe('r1');

    const nova = await s.criarLista('Viagem');
    expect(s.appStore.get().listaAtivaId).toBe(nova.id);
  });

  it('excluir a lista ativa escolhe outra; excluir a última recria "Geral"', async () => {
    const { s, listaId } = await iniciarComLista();
    const nova = await s.criarLista('Viagem');
    await s.excluirLista(nova.id);
    expect(s.appStore.get().listaAtivaId).toBe(listaId);
    await s.excluirLista(listaId);
    expect(s.appStore.get().listas.map((l) => l.nome)).toEqual(['Geral']);
    expect(s.appStore.get().listaAtivaId).toBe(s.appStore.get().listas[0].id);
  });

  it('renomear e limpar histórico', async () => {
    const { s, listaId } = await iniciarComLista();
    await s.renomearLista(listaId, 'Casa');
    expect(s.appStore.get().listas[0].nome).toBe('Casa');
    await s.salvarRemedio(remedio({ id: 'r1', listaId }));
    await s.marcarTomado('r1', 'manha', '08:00');
    await s.limparHistorico();
    expect(s.appStore.get().tomados).toHaveLength(0);
  });
});

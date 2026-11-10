import type { ListaRemedios, Remedio, RemedioTomado } from '@/types/remedio';
import { getDb } from './database';

export type Entidade = 'lista' | 'remedio' | 'tomado' | 'historico';
export type Operacao = 'upsert' | 'delete' | 'limpar';

export interface ItemOutbox {
  seq: number;
  entidade: Entidade;
  operacao: Operacao;
  chave: string;
  payload: string;
  tentativas: number;
  proxima_em: number;
  descartado: number;
  erro: string | null;
}

export const chaveTomado = (t: { remedioId: string; periodo: string; horario: string; data: string }) =>
  `${t.remedioId}|${t.periodo}|${t.horario}|${t.data}`;

// ───────────── meta ─────────────
export async function getMeta(chave: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ valor: string | null }>('SELECT valor FROM meta WHERE chave = ?', [chave]);
  return row?.valor ?? null;
}
export async function setMeta(chave: string, valor: string | null): Promise<void> {
  const db = await getDb();
  if (valor === null) await db.runAsync('DELETE FROM meta WHERE chave = ?', [chave]);
  else await db.runAsync('INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)', [chave, valor]);
}

// ───────────── leitura ─────────────
interface LinhaLista {
  id: string; nome: string; cor: string | null; usuario_id: string | null; criada_em: string; remoto: number;
}
export interface ListaLocal extends ListaRemedios {
  remoto: boolean;
}

export async function obterListas(): Promise<ListaLocal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LinhaLista>('SELECT * FROM listas ORDER BY criada_em ASC');
  return rows.map((l) => ({
    id: l.id,
    nome: l.nome,
    criadaEm: l.criada_em,
    cor: l.cor ?? undefined,
    usuarioId: l.usuario_id ?? undefined,
    remoto: l.remoto === 1,
  }));
}

export async function obterRemedios(): Promise<Remedio[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM remedios ORDER BY atualizado_em DESC');
  return rows.map((r) => JSON.parse(r.json) as Remedio);
}

export async function obterRemedio(id: string): Promise<Remedio | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM remedios WHERE id = ?', [id]);
  return row ? (JSON.parse(row.json) as Remedio) : null;
}

interface LinhaTomado {
  remedio_id: string; periodo: string; horario: string; data: string; id: string | null; lista_id: string | null; tomado_em: string;
}
export async function obterTomados(): Promise<RemedioTomado[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<LinhaTomado>('SELECT * FROM tomados ORDER BY tomado_em DESC');
  return rows.map((t) => ({
    id: t.id ?? undefined,
    listaId: t.lista_id ?? undefined,
    remedioId: t.remedio_id,
    periodo: t.periodo as RemedioTomado['periodo'],
    horario: t.horario,
    data: t.data,
    tomadoEm: t.tomado_em,
  }));
}

// ───────────── outbox ─────────────
type Exec = Pick<Awaited<ReturnType<typeof getDb>>, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

/** Enfileira uma operação. `upsert` repetido da mesma chave é coalescido NO LUGAR (preserva a ordem FIFO). */
async function enfileirarTx(tx: Exec, entidade: Entidade, operacao: Operacao, chave: string, payload: unknown) {
  const json = JSON.stringify(payload ?? {});
  if (operacao === 'upsert') {
    const existente = await tx.getFirstAsync<{ seq: number }>(
      "SELECT seq FROM outbox WHERE entidade = ? AND chave = ? AND operacao = 'upsert' AND descartado = 0 LIMIT 1",
      [entidade, chave],
    );
    if (existente) {
      await tx.runAsync('UPDATE outbox SET payload = ?, tentativas = 0, proxima_em = 0, erro = NULL WHERE seq = ?', [json, existente.seq]);
      return;
    }
  } else if (operacao === 'delete') {
    await tx.runAsync("DELETE FROM outbox WHERE entidade = ? AND chave = ? AND operacao = 'upsert'", [entidade, chave]);
  } else if (operacao === 'limpar') {
    await tx.runAsync("DELETE FROM outbox WHERE entidade = 'tomado'");
  }
  await tx.runAsync(
    'INSERT INTO outbox (entidade, operacao, chave, payload, criado_em) VALUES (?, ?, ?, ?, ?)',
    [entidade, operacao, chave, json, Date.now()],
  );
}

export async function proximoItemOutbox(agora = Date.now()): Promise<ItemOutbox | null> {
  const db = await getDb();
  return db.getFirstAsync<ItemOutbox>(
    'SELECT * FROM outbox WHERE descartado = 0 AND proxima_em <= ? ORDER BY seq ASC LIMIT 1',
    [agora],
  );
}
/** Há item pendente (ainda não descartado) mais antigo que ainda não está pronto? (para não "furar a fila") */
export async function existeOutboxAguardando(): Promise<boolean> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox WHERE descartado = 0');
  return (r?.n ?? 0) > 0;
}
export async function removerItemOutbox(seq: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE seq = ?', [seq]);
}
export async function falharItemOutbox(seq: number, tentativas: number, proximaEm: number, erro: string) {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET tentativas = ?, proxima_em = ?, erro = ? WHERE seq = ?', [tentativas, proximaEm, erro, seq]);
}
export async function descartarItemOutbox(seq: number, erro: string) {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET descartado = 1, erro = ? WHERE seq = ?', [erro, seq]);
}
export async function resumoOutbox(): Promise<{ pendentes: number; descartados: number; ultimoErro: string | null }> {
  const db = await getDb();
  const a = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox WHERE descartado = 0');
  const b = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox WHERE descartado = 1');
  const e = await db.getFirstAsync<{ erro: string | null }>('SELECT erro FROM outbox WHERE erro IS NOT NULL ORDER BY seq DESC LIMIT 1');
  return { pendentes: a?.n ?? 0, descartados: b?.n ?? 0, ultimoErro: e?.erro ?? null };
}
export async function limparDescartados() {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE descartado = 1');
}
export async function reativarOutbox() {
  const db = await getDb();
  await db.runAsync('UPDATE outbox SET descartado = 0, tentativas = 0, proxima_em = 0, erro = NULL');
}
export async function chavesPendentes(): Promise<Record<Entidade, Set<string>>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ entidade: Entidade; chave: string }>('SELECT entidade, chave FROM outbox');
  const out: Record<Entidade, Set<string>> = { lista: new Set(), remedio: new Set(), tomado: new Set(), historico: new Set() };
  for (const r of rows) out[r.entidade].add(r.chave);
  return out;
}

// ───────────── escrita local (+ outbox, na mesma transação) ─────────────
export async function salvarListaLocal(l: ListaLocal, enfileirar = true) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT OR REPLACE INTO listas (id, nome, cor, usuario_id, criada_em, remoto) VALUES (?, ?, ?, ?, ?, ?)',
      [l.id, l.nome, l.cor ?? null, l.usuarioId ?? null, l.criadaEm, l.remoto ? 1 : 0],
    );
    if (enfileirar) await enfileirarTx(db, 'lista', 'upsert', l.id, { id: l.id, nome: l.nome });
  });
}

export async function removerListaLocal(id: string, remoto: boolean) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const rems = await db.getAllAsync<{ id: string }>('SELECT id FROM remedios WHERE lista_id = ?', [id]);
    for (const r of rems) await db.runAsync("DELETE FROM outbox WHERE entidade = 'remedio' AND chave = ?", [r.id]);
    await db.runAsync("DELETE FROM outbox WHERE entidade = 'tomado' AND payload LIKE ?", [`%"listaId":"${id}"%`]);
    await db.runAsync('DELETE FROM remedios WHERE lista_id = ?', [id]);
    await db.runAsync('DELETE FROM tomados WHERE lista_id = ?', [id]);
    await db.runAsync('DELETE FROM listas WHERE id = ?', [id]);
    if (remoto) await enfileirarTx(db, 'lista', 'delete', id, { id });
    else await db.runAsync("DELETE FROM outbox WHERE entidade = 'lista' AND chave = ?", [id]);
  });
}

export async function salvarRemedioLocal(r: Remedio, enfileirar = true) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT OR REPLACE INTO remedios (id, lista_id, json, ativo, atualizado_em) VALUES (?, ?, ?, ?, ?)',
      [r.id, r.listaId, JSON.stringify(r), r.ativo ? 1 : 0, r.atualizadoEm],
    );
    if (enfileirar) await enfileirarTx(db, 'remedio', 'upsert', r.id, r);
  });
}

export async function removerRemedioLocal(id: string) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM remedios WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM tomados WHERE remedio_id = ?', [id]);
    await enfileirarTx(db, 'remedio', 'delete', id, { id });
  });
}

export async function salvarTomadoLocal(t: RemedioTomado, enfileirar = true) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT OR REPLACE INTO tomados (remedio_id, periodo, horario, data, id, lista_id, tomado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [t.remedioId, t.periodo, t.horario, t.data, t.id ?? null, t.listaId ?? null, t.tomadoEm],
    );
    if (enfileirar) await enfileirarTx(db, 'tomado', 'upsert', chaveTomado(t), t);
  });
}

export async function removerTomadoLocal(t: { remedioId: string; periodo: string; horario: string; data: string }) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM tomados WHERE remedio_id = ? AND periodo = ? AND horario = ? AND data = ?', [
      t.remedioId, t.periodo, t.horario, t.data,
    ]);
    await enfileirarTx(db, 'tomado', 'delete', chaveTomado(t), t);
  });
}

export async function limparTomadosLocal() {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM tomados');
    await enfileirarTx(db, 'historico', 'limpar', 'historico', {});
  });
}

/** Troca o id local de uma lista pelo id definitivo do servidor (reescreve remédios, tomados e outbox). */
export async function remapearListaId(antigo: string, novo: string) {
  if (antigo === novo) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE listas SET id = ?, remoto = 1 WHERE id = ?', [novo, antigo]);
    const rems = await db.getAllAsync<{ id: string; json: string }>('SELECT id, json FROM remedios WHERE lista_id = ?', [antigo]);
    for (const r of rems) {
      const obj = JSON.parse(r.json) as Remedio;
      obj.listaId = novo;
      await db.runAsync('UPDATE remedios SET lista_id = ?, json = ? WHERE id = ?', [novo, JSON.stringify(obj), r.id]);
    }
    await db.runAsync('UPDATE tomados SET lista_id = ? WHERE lista_id = ?', [novo, antigo]);
    await db.runAsync("UPDATE outbox SET payload = REPLACE(payload, ?, ?) WHERE payload LIKE ?", [antigo, novo, `%${antigo}%`]);
    await db.runAsync('UPDATE outbox SET chave = ? WHERE entidade = ? AND chave = ?', [novo, 'lista', antigo]);
  });
}

export async function marcarListaRemota(id: string) {
  const db = await getDb();
  await db.runAsync('UPDATE listas SET remoto = 1 WHERE id = ?', [id]);
}

/** Aplica o resultado do pull dentro de UMA transação (protege itens com pendência na outbox). */
export async function aplicarPull(dados: { listas: ListaRemedios[]; remedios: Remedio[]; tomados: RemedioTomado[] }) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    const pend = await chavesPendentes();
    const idsListasServidor = new Set(dados.listas.map((l) => l.id));
    const idsRemediosServidor = new Set(dados.remedios.map((r) => r.id));
    const chavesTomadosServidor = new Set(dados.tomados.map(chaveTomado));

    // listas
    for (const l of dados.listas) {
      if (pend.lista.has(l.id)) continue;
      await db.runAsync(
        'INSERT OR REPLACE INTO listas (id, nome, cor, usuario_id, criada_em, remoto) VALUES (?, ?, ?, ?, ?, 1)',
        [l.id, l.nome, l.cor ?? null, l.usuarioId ?? null, l.criadaEm],
      );
    }
    const locais = await db.getAllAsync<{ id: string; remoto: number }>('SELECT id, remoto FROM listas');
    for (const l of locais) {
      if (l.remoto === 1 && !idsListasServidor.has(l.id) && !pend.lista.has(l.id)) {
        await db.runAsync('DELETE FROM remedios WHERE lista_id = ? AND id NOT IN (SELECT chave FROM outbox WHERE entidade = ?)', [l.id, 'remedio']);
        await db.runAsync('DELETE FROM tomados WHERE lista_id = ?', [l.id]);
        await db.runAsync('DELETE FROM listas WHERE id = ?', [l.id]);
      }
    }

    // remédios
    for (const r of dados.remedios) {
      if (pend.remedio.has(r.id)) continue;
      await db.runAsync(
        'INSERT OR REPLACE INTO remedios (id, lista_id, json, ativo, atualizado_em) VALUES (?, ?, ?, ?, ?)',
        [r.id, r.listaId, JSON.stringify(r), r.ativo ? 1 : 0, r.atualizadoEm],
      );
    }
    const remLocais = await db.getAllAsync<{ id: string }>('SELECT id FROM remedios');
    for (const r of remLocais) {
      if (!idsRemediosServidor.has(r.id) && !pend.remedio.has(r.id)) {
        await db.runAsync('DELETE FROM remedios WHERE id = ?', [r.id]);
      }
    }

    // tomados
    if (!pend.historico.size) {
      for (const t of dados.tomados) {
        if (pend.tomado.has(chaveTomado(t))) continue;
        await db.runAsync(
          'INSERT OR REPLACE INTO tomados (remedio_id, periodo, horario, data, id, lista_id, tomado_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [t.remedioId, t.periodo, t.horario, t.data, t.id ?? null, t.listaId ?? null, t.tomadoEm],
        );
      }
      const tomLocais = await db.getAllAsync<LinhaTomado>('SELECT * FROM tomados');
      for (const t of tomLocais) {
        const k = `${t.remedio_id}|${t.periodo}|${t.horario}|${t.data}`;
        if (!chavesTomadosServidor.has(k) && !pend.tomado.has(k)) {
          await db.runAsync('DELETE FROM tomados WHERE remedio_id = ? AND periodo = ? AND horario = ? AND data = ?', [
            t.remedio_id, t.periodo, t.horario, t.data,
          ]);
        }
      }
    }
  });
}

/** Apaga TODOS os dados locais (usado ao vincular outro código). */
export async function resetarDadosLocais() {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM listas; DELETE FROM remedios; DELETE FROM tomados; DELETE FROM outbox;');
  });
}

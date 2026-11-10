import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const VERSAO_ATUAL = 1;

async function migrar(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  if (v < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS listas (
        id         TEXT PRIMARY KEY NOT NULL,
        nome       TEXT NOT NULL,
        cor        TEXT,
        usuario_id TEXT,
        criada_em  TEXT NOT NULL,
        remoto     INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS remedios (
        id            TEXT PRIMARY KEY NOT NULL,
        lista_id      TEXT NOT NULL,
        json          TEXT NOT NULL,
        ativo         INTEGER NOT NULL DEFAULT 1,
        atualizado_em TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_remedios_lista ON remedios(lista_id);
      CREATE TABLE IF NOT EXISTS tomados (
        remedio_id TEXT NOT NULL,
        periodo    TEXT NOT NULL,
        horario    TEXT NOT NULL,
        data       TEXT NOT NULL,
        id         TEXT,
        lista_id   TEXT,
        tomado_em  TEXT NOT NULL,
        PRIMARY KEY (remedio_id, periodo, horario, data)
      );
      CREATE INDEX IF NOT EXISTS idx_tomados_data ON tomados(data);
      CREATE TABLE IF NOT EXISTS outbox (
        seq         INTEGER PRIMARY KEY AUTOINCREMENT,
        entidade    TEXT NOT NULL,
        operacao    TEXT NOT NULL,
        chave       TEXT NOT NULL,
        payload     TEXT NOT NULL,
        tentativas  INTEGER NOT NULL DEFAULT 0,
        proxima_em  INTEGER NOT NULL DEFAULT 0,
        descartado  INTEGER NOT NULL DEFAULT 0,
        erro        TEXT,
        criado_em   INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        chave TEXT PRIMARY KEY NOT NULL,
        valor TEXT
      );
    `);
    v = 1;
  }
  // Próximas migrações: if (v < 2) { ...; v = 2 }
  await db.execAsync(`PRAGMA user_version = ${VERSAO_ATUAL}`);
}

async function abrir(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('medcontrol.db');
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;');
  await migrar(db);
  return db;
}

/** Abre (uma única vez) e migra o banco local. Seguro para chamar de qualquer lugar, inclusive em segundo plano. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = abrir().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

/* Implementa o subconjunto da API assíncrona do expo-sqlite usado pelo app, sobre node:sqlite (só para testes). */
const { DatabaseSync } = require('node:sqlite');

function criarBancoMemoria() {
  const db = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, params = []) => {
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    getAllAsync: async (sql, params = []) => db.prepare(sql).all(...params),
    getFirstAsync: async (sql, params = []) => db.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (fn) => {
      db.exec('BEGIN');
      try {
        await fn();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

module.exports = { criarBancoMemoria };

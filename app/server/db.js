// SQLite 資料庫（Node.js 內建 node:sqlite，不需額外安裝原生套件）
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// 允許的資料集合（定義在前後端共用的 collections.js）。每一筆紀錄是一列，資料內容存成 JSON。
import { COLLECTIONS } from '../src/lib/collections.js';

export { COLLECTIONS };

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS records (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, collection, id)
    );
    CREATE INDEX IF NOT EXISTS idx_records_user_col ON records(user_id, collection);
  `);
  return db;
}

export function makeRepo(db) {
  const now = () => new Date().toISOString();
  const stmts = {
    all: db.prepare('SELECT collection, data FROM records WHERE user_id = ? ORDER BY created_at'),
    list: db.prepare('SELECT data FROM records WHERE user_id = ? AND collection = ? ORDER BY created_at'),
    get: db.prepare('SELECT data FROM records WHERE user_id = ? AND collection = ? AND id = ?'),
    upsert: db.prepare(`INSERT INTO records (user_id, collection, id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`),
    remove: db.prepare('DELETE FROM records WHERE user_id = ? AND collection = ? AND id = ?'),
    clear: db.prepare('DELETE FROM records WHERE user_id = ?'),
  };
  return {
    all(userId) {
      const out = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
      for (const row of stmts.all.all(userId)) {
        if (out[row.collection]) out[row.collection].push(JSON.parse(row.data));
      }
      return out;
    },
    list(userId, collection) {
      return stmts.list.all(userId, collection).map((r) => JSON.parse(r.data));
    },
    get(userId, collection, id) {
      const row = stmts.get.get(userId, collection, id);
      return row ? JSON.parse(row.data) : null;
    },
    upsert(userId, collection, record) {
      const ts = now();
      const data = { ...record, updatedAt: ts, createdAt: record.createdAt || ts };
      stmts.upsert.run(userId, collection, String(record.id), JSON.stringify(data), data.createdAt, ts);
      return data;
    },
    remove(userId, collection, id) {
      return stmts.remove.run(userId, collection, id).changes > 0;
    },
    // 匯入備份：整批取代，使用交易確保失敗時不會只寫一半
    replaceAll(userId, payload) {
      db.exec('BEGIN');
      try {
        stmts.clear.run(userId);
        for (const c of COLLECTIONS) {
          for (const rec of payload[c] || []) {
            if (!rec || rec.id === undefined) continue;
            const ts = rec.createdAt || now();
            stmts.upsert.run(userId, c, String(rec.id), JSON.stringify(rec), ts, rec.updatedAt || ts);
          }
        }
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

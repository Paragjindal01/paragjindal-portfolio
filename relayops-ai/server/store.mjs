import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, openSync, closeSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as sqlite from 'node:sqlite';

const DatabaseSync = sqlite.Database ?? sqlite.DatabaseSync;

const schema = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workflow_versions (
    owner TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    version INTEGER NOT NULL,
    definition TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (owner, id, version)
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    version INTEGER,
    definition TEXT NOT NULL,
    input TEXT NOT NULL,
    mode TEXT NOT NULL,
    provider TEXT,
    status TEXT NOT NULL,
    replay_of TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT,
    error TEXT,
    idempotency_key TEXT,
    request_hash TEXT,
    UNIQUE (owner, idempotency_key)
  );
  CREATE INDEX IF NOT EXISTS runs_owner_created ON runs(owner, created_at DESC);
  CREATE INDEX IF NOT EXISTS runs_status ON runs(status, created_at);
  CREATE TABLE IF NOT EXISTS steps (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    row_order INTEGER NOT NULL,
    status TEXT NOT NULL,
    attempt INTEGER NOT NULL DEFAULT 0,
    started_at TEXT,
    finished_at TEXT,
    ready_at TEXT,
    output TEXT,
    usage TEXT,
    artifacts TEXT,
    error TEXT,
    PRIMARY KEY (run_id, id)
  );
  CREATE TABLE IF NOT EXISTS events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    at TEXT NOT NULL,
    type TEXT NOT NULL,
    step_id TEXT,
    data TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS events_run_sequence ON events(run_id, sequence);
`;

export const json = (value) => JSON.stringify(value ?? null);
export const parse = (value) => value == null ? null : JSON.parse(value);
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function holdWriterLock(databasePath) {
  if (databasePath === ':memory:') return () => {};
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const lockPath = databasePath + '.worker';
  closeSync(openSync(lockPath, 'a', 0o600));
  const lock = new DatabaseSync(lockPath, { timeout: 100 });
  try {
    // A separate rollback-journal connection keeps the OS lock for the worker's lifetime.
    lock.exec('BEGIN EXCLUSIVE');
  } catch (error) {
    lock.close();
    throw new Error('Another RelayOps worker is using this SQLite file.', { cause: error });
  }
  return () => lock.close();
}

export function openStore(path) {
  const file = path === ':memory:' ? path : resolve(path);
  const unlock = holdWriterLock(file);
  let db;
  try {
    if (file !== ':memory:') closeSync(openSync(file, 'a', 0o600));
    db = new DatabaseSync(file, { timeout: 3000 });
    db.exec(schema);
  } catch (error) {
    db?.close();
    unlock();
    throw error;
  }
  return {
    db,
    transaction(action) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = action();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      try { db.close(); } finally { unlock(); }
    },
  };
}

export function issueSession(db, timestamp) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(timestamp + 7 * 86_400_000).toISOString();
  db.prepare('INSERT INTO sessions (id,token_hash,expires_at) VALUES (?,?,?)').run(randomUUID(), sha256(token), expiresAt);
  return { token, expiresAt };
}

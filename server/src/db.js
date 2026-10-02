import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

export function openDb(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(path.join(dataDir, 'assetflix.db'))
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  migrate(db)
  return db
}

// 事务助手(node:sqlite 没有 .transaction())
export function tx(db, fn) {
  db.exec('BEGIN')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

function migrate(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#E50914',
    emoji TEXT NOT NULL DEFAULT '🎬',
    password_hash TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS member_settings (
    member_id INTEGER PRIMARY KEY REFERENCES members(id),
    thresholds TEXT NOT NULL DEFAULT '[30,14,7,1]',
    channels TEXT NOT NULL DEFAULT '[]',
    digest_hour INTEGER
  );
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'cash',
    currency TEXT NOT NULL DEFAULT 'CNY',
    institution TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    value REAL NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    UNIQUE(account_id, date)
  );
  CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    bank TEXT NOT NULL,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    annual_fee REAL NOT NULL DEFAULT 0,
    fee_month INTEGER,
    fee_day INTEGER,
    waiver_type TEXT NOT NULL DEFAULT 'none',
    waiver_count INTEGER,
    waiver_amount REAL,
    progress_count INTEGER NOT NULL DEFAULT 0,
    progress_amount REAL NOT NULL DEFAULT 0,
    progress_year INTEGER,
    notes TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS benefits (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'count',
    total_count INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    value REAL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    expire_date TEXT,
    notes TEXT,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS benefit_usages (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    benefit_id INTEGER NOT NULL REFERENCES benefits(id) ON DELETE CASCADE,
    used_at TEXT NOT NULL,
    note TEXT
  );
  CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    dedupe_key TEXT UNIQUE,
    source_type TEXT NOT NULL,
    source_id INTEGER,
    title TEXT NOT NULL,
    body TEXT,
    due_date TEXT,
    level TEXT NOT NULL DEFAULT 'info',
    status TEXT NOT NULL DEFAULT 'pending',
    notified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    period TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'monthly',
    data TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(member_id, period)
  );
  CREATE TABLE IF NOT EXISTS xp_events (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    action TEXT NOT NULL,
    xp INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS member_badges (
    member_id INTEGER NOT NULL REFERENCES members(id),
    badge_key TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    PRIMARY KEY (member_id, badge_key)
  );
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'manual',
    target_amount REAL NOT NULL,
    current_amount REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'CNY',
    due_date TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fx_rates (
    date TEXT NOT NULL,
    currency TEXT NOT NULL,
    rate REAL NOT NULL,
    PRIMARY KEY (date, currency)
  );
  CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(member_id, date);
  CREATE INDEX IF NOT EXISTS idx_reminders_member ON reminders(member_id, status);
  `)
}

// ---- kv helpers ----
export function getKV(db, key, def = null) {
  const r = db.prepare('SELECT value FROM kv WHERE key = ?').get(key)
  return r ? r.value : def
}
export function setKV(db, key, value) {
  db.prepare('INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, typeof value === 'string' ? value : JSON.stringify(value))
}
export function getJSON(db, key, def) {
  const raw = getKV(db, key)
  if (raw == null) return def
  try { return JSON.parse(raw) } catch { return def }
}
export function setJSON(db, key, obj) { setKV(db, key, JSON.stringify(obj)) }

const DEFAULT_SETTINGS = { thresholds: [30, 14, 7, 1], channels: [], digest_hour: null }
export function getMemberSettings(db, memberId) {
  const r = db.prepare('SELECT thresholds, channels, digest_hour FROM member_settings WHERE member_id = ?').get(memberId)
  if (!r) return { ...DEFAULT_SETTINGS }
  try {
    return { thresholds: JSON.parse(r.thresholds), channels: JSON.parse(r.channels), digest_hour: r.digest_hour }
  } catch { return { ...DEFAULT_SETTINGS } }
}
export function saveMemberSettings(db, memberId, s) {
  db.prepare(`INSERT INTO member_settings(member_id, thresholds, channels, digest_hour) VALUES(?,?,?,?)
    ON CONFLICT(member_id) DO UPDATE SET thresholds=excluded.thresholds, channels=excluded.channels, digest_hour=excluded.digest_hour`)
    .run(memberId, JSON.stringify(s.thresholds ?? [30, 14, 7, 1]), JSON.stringify(s.channels ?? []),
      s.digest_hour ?? null)
}

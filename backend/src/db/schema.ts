import { Database } from 'bun:sqlite';

const DB_PATH = process.env.DATABASE_PATH ?? '/data/whereis.db';

export const db = new Database(DB_PATH, { create: true });

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS invite_tokens (
    token       TEXT    PRIMARY KEY,
    created_by  INTEGER NOT NULL,
    used_by     INTEGER,
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER
  );

  CREATE TABLE IF NOT EXISTS group_members (
    user_id          INTEGER PRIMARY KEY,
    traccar_user_id  INTEGER NOT NULL,
    role             TEXT    NOT NULL DEFAULT 'member'
                             CHECK (role IN ('admin', 'member')),
    joined_at        INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS user_devices (
    user_id           INTEGER PRIMARY KEY,
    uuid              TEXT    NOT NULL UNIQUE,
    traccar_device_id INTEGER NOT NULL,
    created_at        INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS user_colours (
    user_id     INTEGER PRIMARY KEY,
    colour_hex  TEXT    NOT NULL,
    assigned_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS ntfy_topics (
    user_id INTEGER PRIMARY KEY,
    topic   TEXT    NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id    INTEGER NOT NULL,
    event_type TEXT    NOT NULL,
    scope      TEXT    NOT NULL CHECK (scope IN ('own', 'anyone')),
    enabled    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (user_id, event_type, scope)
  );
`);

export type Role = 'admin' | 'member';
export type Scope = 'own' | 'anyone';

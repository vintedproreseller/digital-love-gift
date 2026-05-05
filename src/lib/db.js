/**
 * db.js — SQLite via sql.js (pure JavaScript, no C++ build tools needed)
 * Works on Windows, Mac, Linux without any native compilation.
 * Data persisted to data/gifts.db
 */

const path = require('path');
const fs   = require('fs');

const DB_PATH = path.resolve(process.cwd(), 'data', 'gifts.db');

let _db = null;

async function getDb() {
  if (_db) return _db;

  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }

  _db.run(`
    CREATE TABLE IF NOT EXISTS gifts (
      id                TEXT PRIMARY KEY,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      partner_name      TEXT NOT NULL,
      occasion          TEXT NOT NULL,
      tone              TEXT NOT NULL,
      song              TEXT,
      song_url          TEXT,
      relationship_date TEXT,
      memories          TEXT NOT NULL,
      traits            TEXT NOT NULL,
      timeline          TEXT,
      images            TEXT,
      ai_content        TEXT NOT NULL,
      password_hash     TEXT,
      is_protected      INTEGER NOT NULL DEFAULT 0,
      view_count        INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS reactions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      gift_id    TEXT NOT NULL,
      emoji      TEXT NOT NULL,
      message    TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reactions_gift ON reactions(gift_id);
  `);

  persist();
  return _db;
}

function persist() {
  if (!_db) return;
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
  } catch (e) {
    console.error('DB persist error:', e);
  }
}

async function saveGift(gift) {
  const db = await getDb();
  db.run(
    `INSERT INTO gifts
      (id, partner_name, occasion, tone, song, song_url, relationship_date,
       memories, traits, timeline, images, ai_content, password_hash, is_protected)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      gift.id,
      gift.formData.partnerName,
      gift.formData.occasion,
      gift.formData.tone,
      gift.formData.song || null,
      gift.formData.songUrl || null,
      gift.formData.relationshipDate || null,
      JSON.stringify(gift.formData.memories),
      JSON.stringify(gift.formData.traits),
      JSON.stringify(gift.formData.timeline || []),
      JSON.stringify(gift.images || []),
      JSON.stringify(gift.content),
      gift.passwordHash || null,
      gift.isPasswordProtected ? 1 : 0,
    ]
  );
  persist();
}

async function getGift(id) {
  const db  = await getDb();
  const res = db.exec('SELECT * FROM gifts WHERE id = ?', [id]);
  if (!res.length || !res[0].values.length) return null;

  db.run('UPDATE gifts SET view_count = view_count + 1 WHERE id = ?', [id]);
  persist();

  const cols = res[0].columns;
  const row  = Object.fromEntries(cols.map((c, i) => [c, res[0].values[0][i]]));
  return rowToGift(row);
}

function rowToGift(row) {
  return {
    id:        row.id,
    createdAt: row.created_at,
    viewCount: row.view_count,
    formData: {
      partnerName:      row.partner_name,
      occasion:         row.occasion,
      tone:             row.tone,
      song:             row.song,
      songUrl:          row.song_url,
      relationshipDate: row.relationship_date,
      memories:         JSON.parse(row.memories),
      traits:           JSON.parse(row.traits),
      timeline:         JSON.parse(row.timeline || '[]'),
    },
    images:              JSON.parse(row.images || '[]'),
    content:             JSON.parse(row.ai_content),
    passwordHash:        row.password_hash,
    isPasswordProtected: row.is_protected === 1,
  };
}

async function addReaction(giftId, emoji, message) {
  const db = await getDb();
  db.run('INSERT INTO reactions (gift_id, emoji, message) VALUES (?,?,?)', [giftId, emoji, message || null]);
  persist();
  return getReactions(giftId);
}

async function getReactions(giftId) {
  const db  = await getDb();
  const res = db.exec(
    'SELECT emoji, message, created_at FROM reactions WHERE gift_id = ? ORDER BY created_at DESC',
    [giftId]
  );
  if (!res.length) return [];
  const cols = res[0].columns;
  return res[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

module.exports = { saveGift, getGift, addReaction, getReactions };

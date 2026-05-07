/**
 * db.js — PostgreSQL via pg (Neon-compatible)
 * Uses a module-level Pool with a global cache to survive Next.js hot reloads.
 * All functions are async; same external API as the old sql.js version.
 */

const { Pool } = require('pg');

// Reuse pool across Next.js hot reloads in dev
const pool = global._pgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});
global._pgPool = pool;

// Run DDL once per process (cached in global so hot reloads don't re-run it)
const dbReady = (global._dbInit = global._dbInit ?? initDb());

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gifts (
      id                TEXT        PRIMARY KEY,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      partner_name      TEXT        NOT NULL,
      occasion          TEXT        NOT NULL,
      tone              TEXT        NOT NULL,
      song              TEXT,
      song_url          TEXT,
      relationship_date TEXT,
      memories          TEXT        NOT NULL,
      traits            TEXT        NOT NULL,
      timeline          TEXT,
      images            TEXT,
      ai_content        TEXT        NOT NULL,
      password_hash     TEXT,
      is_protected      BOOLEAN     NOT NULL DEFAULT FALSE,
      view_count        INTEGER     NOT NULL DEFAULT 0,
      is_paid           BOOLEAN     NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS reactions (
      id         SERIAL      PRIMARY KEY,
      gift_id    TEXT        NOT NULL,
      emoji      TEXT        NOT NULL,
      message    TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_reactions_gift ON reactions(gift_id);
  `);

  // Migration: add payment intent column to existing databases
  await pool.query(`
    ALTER TABLE gifts
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT
  `).catch(() => {});
}

// ── saveGift ──────────────────────────────────────────────────
async function saveGift(gift) {
  await dbReady;
  await pool.query(
    `INSERT INTO gifts
       (id, partner_name, occasion, tone, song, song_url, relationship_date,
        memories, traits, timeline, images, ai_content, password_hash, is_protected)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      gift.id,
      gift.formData.partnerName,
      gift.formData.occasion,
      gift.formData.tone,
      gift.formData.song         || null,
      gift.formData.songUrl      || null,
      gift.formData.relationshipDate || null,
      JSON.stringify(gift.formData.memories),
      JSON.stringify(gift.formData.traits),
      JSON.stringify(gift.formData.timeline || []),
      JSON.stringify(gift.images  || []),
      JSON.stringify(gift.content),
      gift.passwordHash           || null,
      gift.isPasswordProtected    ?? false,
    ]
  );
}

// ── getGift ───────────────────────────────────────────────────
async function getGift(id) {
  await dbReady;
  const { rows } = await pool.query('SELECT * FROM gifts WHERE id = $1', [id]);
  if (!rows.length) return null;

  // Fire-and-forget view count bump
  pool.query('UPDATE gifts SET view_count = view_count + 1 WHERE id = $1', [id]).catch(() => {});

  return rowToGift(rows[0]);
}

// ── markGiftPaid ──────────────────────────────────────────────
async function markGiftPaid(id, paymentIntentId) {
  await dbReady;
  // COALESCE preserves existing payment intent ID if new value is null (client-side confirm-payment)
  await pool.query(
    'UPDATE gifts SET is_paid = TRUE, stripe_payment_intent_id = COALESCE($1, stripe_payment_intent_id) WHERE id = $2',
    [paymentIntentId || null, id]
  );
}

// ── addReaction ───────────────────────────────────────────────
async function addReaction(giftId, emoji, message) {
  await dbReady;
  await pool.query(
    'INSERT INTO reactions (gift_id, emoji, message) VALUES ($1,$2,$3)',
    [giftId, emoji, message || null]
  );
  return getReactions(giftId);
}

// ── getReactions ──────────────────────────────────────────────
async function getReactions(giftId) {
  await dbReady;
  const { rows } = await pool.query(
    'SELECT emoji, message, created_at FROM reactions WHERE gift_id = $1 ORDER BY created_at DESC',
    [giftId]
  );
  return rows;
}

// ── rowToGift ─────────────────────────────────────────────────
function rowToGift(row) {
  return {
    id:        row.id,
    createdAt: row.created_at,
    viewCount: row.view_count,
    isPaid:    row.is_paid,
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
    images:              JSON.parse(row.images    || '[]'),
    content:             JSON.parse(row.ai_content),
    passwordHash:        row.password_hash,
    isPasswordProtected: row.is_protected,
  };
}

module.exports = { saveGift, getGift, markGiftPaid, addReaction, getReactions };

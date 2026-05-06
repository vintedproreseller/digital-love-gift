/**
 * gift.js — Premium Gift Viewer v5
 * Bug fixes: single DOMContentLoaded, no bg canvas, YouTube embed,
 * caption cycling, preview mode, PDF download, QR, reactions
 */

'use strict';

let giftData      = null;
let selectedEmoji = null;
let qrGenerated   = false;

const params      = new URLSearchParams(window.location.search);
const giftId      = params.get('id') || window.location.pathname.split('/gift/')[1];
const isPreview   = params.get('preview') === 'true';
const isPaidParam = params.get('paid') === 'true';

// ── Occasion → CSS theme class ────────────────────────────────
const occasionThemeMap = {
  'Birthday':        'theme-birthday',
  'Anniversary':     'theme-anniversary',
  "Valentine's Day": 'theme-valentine',
  'Proposal':        'theme-proposal',
};
function applyOccasionTheme(occasion) {
  const cls = occasionThemeMap[occasion];
  if (cls) document.body.classList.add(cls);
}

// ═══════════════════════════════════════════════════════════════
//  SINGLE BOOT — one DOMContentLoaded only
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Wire envelope click listener here (not in a second DOMContentLoaded)
  const envScr = document.getElementById('envelope-screen');
  if (envScr) {
    envScr.addEventListener('click', () => {
      if (!envScr.classList.contains('hidden')) openEnvelope();
    });
  }

  if (!giftId) return showError();

  try {
    const res  = await fetch(`/api/gift/${giftId}`);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();

    // ── 1. Confirm payment if Stripe just redirected here ─────
    if (isPaidParam && !data.isPaid) {
      try {
        await fetch(`/api/gift/${giftId}/confirm-payment`, { method: 'POST' });
        data.isPaid = true;
      } catch { /* non-fatal — webhook will also mark paid */ }
    }

    // ── 2. Payment gate — gift not yet paid ───────────────────
    // Skip gate for previews; for password-protected gifts the
    // password is their protection so we don't double-gate.
    if (!data.isPaid && !isPreview && !data.isPasswordProtected) {
      giftData = data;
      applyOccasionTheme(data.formData?.occasion);
      hideLoading();
      // Render whatever content we have (may be sparse for unpaid gifts)
      if (data.content) {
        renderGift(giftData);
        initBackgroundStickers(data.formData?.occasion);
      }
      document.body.classList.add('preview-mode');
      show('gift-content');
      const lockEl = document.getElementById('preview-lock');
      if (lockEl) {
        lockEl.classList.remove('hidden');
        const payBtn = document.getElementById('preview-pay-btn');
        if (payBtn) payBtn.href = `/pay.html?id=${giftId}`;
      }
      initScrollFades();
      return;
    }

    // ── 3. Preview mode (?preview=true) ───────────────────────
    if (isPreview) {
      if (data.isPasswordProtected && !data.content) {
        window.location.href = `/gift.html?id=${giftId}`;
        return;
      }
      giftData = data;
      applyOccasionTheme(data.formData?.occasion);
      hideLoading();
      renderGift(giftData);
      initBackgroundStickers(data.formData?.occasion);
      document.body.classList.add('preview-mode');
      show('gift-content');
      show('preview-lock');
      const payBtn = document.getElementById('preview-pay-btn');
      if (payBtn) payBtn.href = `/pay.html?id=${giftId}`;
      initScrollFades();
      return;
    }

    // ── 4. Normal flow ────────────────────────────────────────
    if (data.isPasswordProtected) {
      const sub = document.getElementById('lock-sub');
      if (sub) sub.textContent = `Enter the password to open ${data.formData.partnerName}'s gift`;
      hideLoading();
      show('lock-screen');
      document.getElementById('lock-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') unlockGift();
      });
    } else {
      giftData = data;
      applyOccasionTheme(data.formData.occasion);
      hideLoading();
      showPetalOverlay(() => show('envelope-screen'));
    }
  } catch {
    showError();
  }
});

// ═══════════════════════════════════════════════════════════════
//  PETAL OVERLAY — cinematic 2-3 s opening (no emoji, CSS shapes)
// ═══════════════════════════════════════════════════════════════
function showPetalOverlay(callback) {
  const overlay = document.getElementById('petal-overlay');
  if (!overlay) { callback(); return; }

  overlay.classList.remove('hidden');
  const colors = ['#f5c6d0','#fde8ed','#fbc8d4','#e8a0b0','#c96a7a','#ffd6e2','#f9d0d8'];
  const shapes = ['50% 0 50% 0','0 50% 0 50%','50% 50% 0 0','0 0 50% 50%'];

  for (let i = 0; i < 38; i++) {
    const p    = document.createElement('div');
    p.className = 'falling-petal';
    const size = Math.random() * 12 + 7;
    p.style.cssText = [
      `left:${Math.random() * 100}%`,
      `width:${size}px`,
      `height:${size * 1.35}px`,
      `background:${colors[Math.floor(Math.random() * colors.length)]}`,
      `animation-duration:${(Math.random() * 2.2 + 1.8).toFixed(2)}s`,
      `animation-delay:${(Math.random() * 2.0).toFixed(2)}s`,
      `border-radius:${shapes[Math.floor(Math.random() * shapes.length)]}`,
      `opacity:${(Math.random() * 0.4 + 0.4).toFixed(2)}`,
    ].join(';');
    overlay.appendChild(p);
  }

  setTimeout(() => {
    overlay.classList.add('fade-out');
    setTimeout(() => { overlay.classList.add('hidden'); callback(); }, 1000);
  }, 2400);
}

// ═══════════════════════════════════════════════════════════════
//  HEART LOCK
// ═══════════════════════════════════════════════════════════════
async function unlockGift() {
  const pw  = document.getElementById('lock-input').value.trim();
  const btn = document.getElementById('lock-btn');
  const err = document.getElementById('lock-error');
  if (!pw) return;

  btn.textContent = 'Opening… 💝';
  btn.disabled    = true;
  err.classList.add('hidden');

  try {
    const res  = await fetch(`/api/gift/${giftId}/unlock`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: pw }),
    });
    const data = await res.json();

    if (data.success) {
      giftData = data.gift;
      applyOccasionTheme(giftData.formData.occasion);
      const svg = document.getElementById('heart-lock-svg');
      svg.classList.add('unlocked');
      setTimeout(() => {
        hide('lock-screen');
        showPetalOverlay(() => show('envelope-screen'));
      }, 900);
    } else {
      throw new Error(data.error);
    }
  } catch (e) {
    const svg = document.getElementById('heart-lock-svg');
    svg.classList.add('shake');
    setTimeout(() => svg.classList.remove('shake'), 500);
    err.textContent = e.message || 'Wrong password 💔';
    err.classList.remove('hidden');
    btn.textContent = 'Unlock 💝';
    btn.disabled    = false;
    document.getElementById('lock-input').value = '';
    document.getElementById('lock-input').focus();
  }
}

// ═══════════════════════════════════════════════════════════════
//  ENVELOPE — called once via the single click listener above
// ═══════════════════════════════════════════════════════════════
function openEnvelope() {
  const env = document.getElementById('envelope');
  env.classList.add('opening');
  setTimeout(() => {
    hide('envelope-screen');
    renderGift(giftData);
    initBackgroundStickers(giftData.formData.occasion);
    show('gift-content');
    launchConfetti();
    initScrollFades();
    startTypewriter();
    loadReactions();
  }, 900);
}

// ═══════════════════════════════════════════════════════════════
//  RENDER GIFT
// ═══════════════════════════════════════════════════════════════
function renderGift(gift) {
  const { formData, images, content } = gift;
  document.title = `${content.title} 💝`;

  // Hero
  set('gift-occasion',     formData.occasion);
  set('gift-title',        content.title);
  set('gift-subtitle',     content.subtitle || '');
  set('gift-partner-name', formData.partnerName);
  set('gift-date',         formatDate(gift.createdAt));

  // Days counter
  if (formData.relationshipDate) {
    const days = Math.floor((Date.now() - new Date(formData.relationshipDate)) / 86400000);
    show('days-counter');
    animateCount(document.getElementById('days-number'), days, 2000);
  }

  // Photo collage
  buildCollage(images, content.captions);

  // Letter — stored for typewriter, not rendered here
  window._letterText = content.letter || '';

  // Poem
  if (content.poem) {
    document.getElementById('gift-poem').textContent = content.poem;
  } else {
    hide('poem-section');
  }

  // Timeline
  buildTimeline(formData.timeline, content.timelineCaptions);

  // Reasons
  const rList = document.getElementById('reasons-list');
  (content.reasons || []).forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'reason-item fade-scroll';
    d.innerHTML = `<div class="reason-num">${i + 1}</div><div>${esc(r)}</div>`;
    rList.appendChild(d);
  });

  // Song + optional YouTube embed
  if (formData.song) {
    set('song-name', formData.song);
    set('song-note', content.songNote || '');
    const videoId = extractYouTubeId(formData.songUrl);
    if (videoId) {
      const songSection = document.getElementById('song-section');
      const wrap = document.createElement('div');
      wrap.className = 'yt-embed-wrap';
      wrap.innerHTML = `<iframe
        src="https://www.youtube.com/embed/${videoId}"
        title="${esc(formData.song)}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>`;
      songSection.appendChild(wrap);
    }
  } else {
    hide('song-section');
  }

  // Final message
  set('final-message', content.finalMessage);
}

// ═══════════════════════════════════════════════════════════════
//  YOUTUBE ID EXTRACTION
// ═══════════════════════════════════════════════════════════════
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// ═══════════════════════════════════════════════════════════════
//  MAGAZINE COLLAGE — captions cycle if fewer than photos
// ═══════════════════════════════════════════════════════════════
function buildCollage(images, captions) {
  const grid = document.getElementById('magazine-collage');
  if (!images || images.length === 0) { hide('collage-section'); return; }

  grid.classList.add(`photos-${Math.min(images.length, 5)}`);
  images.forEach((src, i) => {
    // Cycle captions so there's always one per photo; cap to actual caption count
    const caption = captions && captions.length > 0
      ? captions[i % captions.length]
      : null;
    const item = document.createElement('div');
    item.className = 'col-item';
    item.innerHTML = `
      <img src="${src}" alt="Memory ${i + 1}" loading="lazy"/>
      ${caption ? `<div class="col-caption">${esc(caption)}</div>` : ''}
    `;
    grid.appendChild(item);
    item.style.opacity   = '0';
    item.style.transform = 'scale(0.94)';
    item.style.transition = `opacity .6s ${i * 0.12}s ease, transform .6s ${i * 0.12}s ease`;
    setTimeout(() => { item.style.opacity = '1'; item.style.transform = 'scale(1)'; }, 100);
  });
}

// ═══════════════════════════════════════════════════════════════
//  TYPEWRITER LETTER — starts once, only one version shown
// ═══════════════════════════════════════════════════════════════
let typewriterDone = false;

function startTypewriter() {
  const container = document.getElementById('typewriter-text');
  const fullText  = window._letterText || '';
  if (!fullText || !container) return;

  // Guard: if already started (shouldn't happen now), bail out
  if (container.children.length > 0) return;

  const paragraphs = fullText.split(/\n\n+/).filter(p => p.trim());
  let pIdx = 0, cIdx = 0, currentP = null;
  const cursor = document.createElement('span');
  cursor.className = 'typewriter-cursor';
  const speed = 18;

  function typeNext() {
    if (pIdx >= paragraphs.length) {
      cursor.remove();
      typewriterDone = true;
      return;
    }
    if (cIdx === 0) {
      currentP = document.createElement('p');
      container.appendChild(currentP);
    }
    const para = paragraphs[pIdx];
    if (cIdx < para.length) {
      currentP.textContent = para.slice(0, cIdx + 1);
      currentP.appendChild(cursor);
      cIdx++;
      setTimeout(typeNext, speed);
    } else {
      pIdx++; cIdx = 0;
      setTimeout(typeNext, 300);
    }
  }

  const letterEl = document.querySelector('.gift-letter');
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) { obs.disconnect(); typeNext(); }
  }, { threshold: 0.2 });
  obs.observe(letterEl);
}

function showFullLetter() {
  const container = document.getElementById('typewriter-text');
  const fullText  = window._letterText || '';
  container.innerHTML = '';
  fullText.split(/\n\n+/).filter(p => p.trim()).forEach(p => {
    const el = document.createElement('p');
    el.textContent = p;
    container.appendChild(el);
  });
  document.getElementById('read-full-btn')?.classList.add('hidden');
  typewriterDone = true;
}

// ═══════════════════════════════════════════════════════════════
//  TIMELINE
// ═══════════════════════════════════════════════════════════════
function buildTimeline(timeline, captions) {
  if (!timeline || timeline.length === 0) { hide('timeline-section'); return; }
  const c = document.getElementById('timeline');
  timeline.forEach((item, i) => {
    const el = document.createElement('div');
    el.className = 'timeline-item';
    el.innerHTML = `
      <div class="timeline-date">${formatDate(item.date)}</div>
      <div class="timeline-event">${esc(item.event)}</div>
      ${captions && captions[i] ? `<div class="timeline-note">${esc(captions[i])}</div>` : ''}
    `;
    c.appendChild(el);
  });
}

// ═══════════════════════════════════════════════════════════════
//  CONFETTI BURST — rAF-driven, 30 particles, hard 4 s cap
// ═══════════════════════════════════════════════════════════════
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx    = canvas.getContext('2d');
  const hearts = ['💝','💖','💗','🌸','✨','💕','🎉'];

  // 30 particles max — enough for visual impact, light on the GPU
  const pieces = Array.from({ length: 30 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height - canvas.height,
    vx:    (Math.random() - 0.5) * 5,
    vy:    Math.random() * 4 + 2,
    size:  Math.random() * 22 + 12,
    spin:  Math.random() * 0.15 - 0.075,
    angle: Math.random() * Math.PI * 2,
    emoji: hearts[Math.floor(Math.random() * hearts.length)],
    alpha: 1,
    decay: Math.random() * 0.010 + 0.005, // slightly faster decay for 30 pieces
  }));

  const DURATION = 4000; // hard cap — 4 seconds
  const startTs  = performance.now();
  let   rafId;

  function draw(now) {
    // Hard 4-second kill — cancelAnimationFrame so nothing lingers
    if (now - startTs > DURATION) {
      cancelAnimationFrame(rafId);
      canvas.style.display = 'none';
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;

    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      if (p.alpha <= 0) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font        = `${p.size}px serif`;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillText(p.emoji, -p.size / 2, p.size / 2);
      ctx.restore();
      // Physics — uses canvas transforms, not DOM top/left
      p.x     += p.vx;
      p.y     += p.vy;
      p.vy    += 0.12; // gravity
      p.angle += p.spin;
      p.alpha -= p.decay;
    }

    if (alive > 0) {
      rafId = requestAnimationFrame(draw);
    } else {
      canvas.style.display = 'none';
    }
  }

  rafId = requestAnimationFrame(draw);
}

// ═══════════════════════════════════════════════════════════════
//  BACKGROUND STICKERS — occasion-aware, 20 elements, rAF loop
// ═══════════════════════════════════════════════════════════════
let _bgStickerRafId = null;
let _bgStickerReady = false;

function initBackgroundStickers(occasion) {
  if (_bgStickerReady) return;
  _bgStickerReady = true;

  const emojiSets = {
    'Birthday':        ['🎂','🎁','🎈','⭐','✨'],
    'Anniversary':     ['💍','🌹','💫','✨','💝'],
    "Valentine's Day": ['💝','💖','🌹','💋','✨'],
    'Proposal':        ['💍','💝','✨','🌸','💫'],
  };
  const emojis     = emojiSets[occasion] || ['💝','💖','💗','🌸','✨'];
  const COUNT      = 20;
  const vh         = window.innerHeight;
  const initTs     = performance.now();
  // Extra space above + below the viewport so transitions are seamless
  const travelPx   = vh + 80;

  const stickers = Array.from({ length: COUNT }, () => {
    const el       = document.createElement('div');
    el.className   = 'bg-sticker';
    const size     = Math.random() * 16 + 16;                   // 16–32 px
    const x        = Math.random() * 100;                        // 0–100 vw
    const duration = (Math.random() * 20 + 15) * 1000;          // 15–35 s
    const opacity  = +(Math.random() * 0.4 + 0.4).toFixed(2);   // 0.4–0.8
    const phase    = Math.random() * duration;                   // random start offset

    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    // Fixed position, below viewport initially; movement via transform only
    el.style.cssText =
      `left:${x}vw;bottom:${-size}px;font-size:${size}px;` +
      `will-change:transform,opacity;`;
    document.body.appendChild(el);

    return { el, duration, phase, opacity };
  });

  function tick(ts) {
    const elapsed = ts - initTs;

    for (let i = 0; i < stickers.length; i++) {
      const s        = stickers[i];
      const progress = ((elapsed + s.phase) % s.duration) / s.duration; // 0→1
      const y        = -(progress * travelPx);  // 0 → -(vh+80), floats upward

      // Fade out smoothly in the top 30% of travel
      const alpha = progress > 0.7
        ? s.opacity * (1 - (progress - 0.7) / 0.3)
        : s.opacity;

      // GPU-composited — only transform and opacity, never top/left
      s.el.style.transform = `translateY(${y}px)`;
      s.el.style.opacity   = alpha;
    }

    _bgStickerRafId = requestAnimationFrame(tick);
  }

  _bgStickerRafId = requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════
//  PDF DOWNLOAD
// ═══════════════════════════════════════════════════════════════
function downloadPDF() {
  document.querySelectorAll('.fade-scroll').forEach(el => el.classList.add('visible'));
  setTimeout(() => window.print(), 120);
}

// ═══════════════════════════════════════════════════════════════
//  REACTIONS
// ═══════════════════════════════════════════════════════════════
async function loadReactions() {
  try {
    const res  = await fetch(`/api/gift/${giftId}/reactions`);
    const data = await res.json();
    displayReactions(data.reactions || []);
  } catch {}
}

function sendReaction(emoji) {
  selectedEmoji = emoji;
  document.querySelectorAll('.reaction-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.emoji === emoji);
  });
  document.getElementById('reaction-message-wrap').classList.remove('hidden');
}

async function submitReaction() {
  if (!selectedEmoji) return;
  const message = document.getElementById('reaction-message').value.trim();
  try {
    const res  = await fetch(`/api/gift/${giftId}/react`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ emoji: selectedEmoji, message }),
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('reaction-message-wrap').classList.add('hidden');
      document.getElementById('reaction-sent-emoji').textContent = selectedEmoji;
      show('reaction-sent');
      displayReactions(data.reactions);
    }
  } catch {}
}

function displayReactions(reactions) {
  const el = document.getElementById('reactions-display');
  if (!reactions || reactions.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = reactions.map(r =>
    `<div class="reaction-pill">${r.emoji}${r.message ? ' · ' + esc(r.message) : ''}</div>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════════
//  QR CODE
// ═══════════════════════════════════════════════════════════════
function toggleQR() {
  const panel = document.getElementById('qr-panel');
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    if (!qrGenerated) {
      qrGenerated = true;
      new QRCode(document.getElementById('qr-code'), {
        text:         window.location.href,
        width:        180,
        height:       180,
        colorDark:    '#a0485a',
        colorLight:   '#fffaf8',
        correctLevel: QRCode.CorrectLevel.M,
      });
    }
  } else {
    panel.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════════════════════
//  SCROLL FADES
// ═══════════════════════════════════════════════════════════════
function initScrollFades() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-scroll').forEach(el => obs.observe(el));
}

// ═══════════════════════════════════════════════════════════════
//  COUNT-UP
// ═══════════════════════════════════════════════════════════════
function animateCount(el, target, duration) {
  const start = Date.now();
  const iv = setInterval(() => {
    const p = Math.min((Date.now() - start) / duration, 1);
    el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString();
    if (p >= 1) clearInterval(iv);
  }, 16);
}

// ═══════════════════════════════════════════════════════════════
//  COPY LINK
// ═══════════════════════════════════════════════════════════════
function copyLink() {
  const btn = document.getElementById('copy-link-btn');
  navigator.clipboard.writeText(window.location.href).then(() => {
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '🔗 Copy Link'; btn.classList.remove('copied'); }, 2500);
  });
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function show(id)  { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id)  { document.getElementById(id)?.classList.add('hidden'); }
function set(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function hideLoading() { hide('gift-loading'); }
function showError()   { hideLoading(); show('gift-error'); }
function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return iso; }
}
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Expose globals for inline HTML handlers
window.unlockGift     = unlockGift;
window.copyLink       = copyLink;
window.toggleQR       = toggleQR;
window.downloadPDF    = downloadPDF;
window.sendReaction   = sendReaction;
window.submitReaction = submitReaction;
window.showFullLetter = showFullLetter;

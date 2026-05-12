/**
 * gift.js — Magazine Flip-Book Viewer v6
 * 10-page StPageFlip magazine replacing the old scrolling layout.
 * All existing logic preserved: password lock, payment gate,
 * envelope animation, reactions, QR, copy link.
 */

'use strict';

let giftData      = null;
let selectedEmoji = null;
let pageFlip      = null;
let totalPages    = 10;

const params      = new URLSearchParams(window.location.search);
const giftId      = params.get('id') || window.location.pathname.split('/gift/')[1];
const isPreview   = params.get('preview') === 'true';
const isPaidParam = params.get('paid') === 'true';

// ── Occasion → theme ──────────────────────────────────────────
const occasionThemeMap = {
  'Birthday':        'theme-birthday',
  'Anniversary':     'theme-anniversary',
  "Valentine's Day": 'theme-valentine',
  'Proposal':        'theme-proposal',
};
const occasionEmoji = {
  'Birthday':        '🎂',
  'Anniversary':     '💍',
  "Valentine's Day": '💝',
  'Proposal':        '💎',
};
const occasionGradient = {
  'Birthday':        'linear-gradient(160deg,#d97706,#92400e,#b45309)',
  'Anniversary':     'linear-gradient(160deg,#9f1239,#7f1d1d,#be185d)',
  "Valentine's Day": 'linear-gradient(160deg,#e11d48,#be185d,#9d174d)',
  'Proposal':        'linear-gradient(160deg,#b45309,#78350f,#d97706)',
};
const defaultGradient = 'linear-gradient(160deg,#c96a7a,#7d1d3f,#a0485a)';

function applyOccasionTheme(occasion) {
  const cls = occasionThemeMap[occasion];
  if (cls) document.body.classList.add(cls);
}

// ═══════════════════════════════════════════════════════════════
//  SINGLE BOOT
// ═══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
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

    // ── 1. Confirm payment if Stripe just redirected ──────────
    if (isPaidParam && !data.isPaid) {
      try {
        await fetch(`/api/gift/${giftId}/confirm-payment`, { method: 'POST' });
        data.isPaid = true;
      } catch { /* non-fatal */ }
    }

    // ── 2. Payment gate ───────────────────────────────────────
    if (!data.isPaid && !isPreview && !data.isPasswordProtected) {
      giftData = data;
      applyOccasionTheme(data.formData?.occasion);
      hideLoading();
      const hasContent = !!data.content;
      if (hasContent) {
        renderGift(giftData);
        initBackgroundStickers(data.formData?.occasion);
      }
      document.body.classList.add('preview-mode');
      show('gift-content');
      if (hasContent) setTimeout(initMagazine, 60);
      const lockEl = document.getElementById('preview-lock');
      if (lockEl) {
        lockEl.classList.remove('hidden');
        const payBtn = document.getElementById('preview-pay-btn');
        if (payBtn) payBtn.href = `/pay.html?id=${giftId}`;
      }
      return;
    }

    // ── 3. Preview mode ───────────────────────────────────────
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
      setTimeout(initMagazine, 60);
      const payBtn = document.getElementById('preview-pay-btn');
      if (payBtn) payBtn.href = `/pay.html?id=${giftId}`;
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
//  PETAL OVERLAY
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
//  ENVELOPE → MAGAZINE
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
    loadReactions();
    // Slight delay so browser paints the now-visible container
    // before StPageFlip reads its dimensions
    setTimeout(initMagazine, 60);
  }, 900);
}

// ═══════════════════════════════════════════════════════════════
//  OG META
// ═══════════════════════════════════════════════════════════════
function injectOgMeta(gift) {
  const origin  = window.location.origin;
  const ogTitle = `A gift for ${gift.formData.partnerName} 💝`;
  const ogDesc  = `A personal ${gift.formData.occasion || 'love'} gift created just for ${gift.formData.partnerName}. Open to see something beautiful.`;
  const ogImage = `${origin}/api/og/${giftId}`;
  const ogUrl   = `${origin}/gift/${giftId}`;

  const tags = [
    { attr: 'property', val: 'og:title',           content: ogTitle   },
    { attr: 'property', val: 'og:description',     content: ogDesc    },
    { attr: 'property', val: 'og:image',            content: ogImage   },
    { attr: 'property', val: 'og:url',              content: ogUrl     },
    { attr: 'property', val: 'og:type',             content: 'website' },
    { attr: 'name',     val: 'twitter:card',        content: 'summary_large_image' },
    { attr: 'name',     val: 'twitter:title',       content: ogTitle   },
    { attr: 'name',     val: 'twitter:description', content: ogDesc    },
    { attr: 'name',     val: 'twitter:image',       content: ogImage   },
  ];
  tags.forEach(({ attr, val, content }) => {
    let el = document.querySelector(`meta[${attr}="${val}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, val); document.head.appendChild(el); }
    el.setAttribute('content', content);
  });
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = ogUrl;
}

// ═══════════════════════════════════════════════════════════════
//  RENDER GIFT — populates all 10 magazine pages
// ═══════════════════════════════════════════════════════════════
function renderGift(gift) {
  const { formData, images, content } = gift;
  document.title = `${content.title} 💝`;
  injectOgMeta(gift);

  const occasion = formData.occasion || '';
  const grad     = occasionGradient[occasion] || defaultGradient;

  // ── Page 1: Front Cover ──────────────────────────────────────
  const coverGrad = document.getElementById('cover-gradient');
  if (coverGrad) coverGrad.style.background = grad;

  set('cover-emoji',          occasionEmoji[occasion] || '💝');
  set('cover-title',          content.title);
  set('cover-for',            `For ${formData.partnerName}`);
  set('cover-quote',          content.coverQuote || '');
  set('cover-issue-date',     formatDate(new Date().toISOString()));
  set('cover-occasion-badge', occasion);

  if (formData.relationshipDate) {
    const days = Math.floor((Date.now() - new Date(formData.relationshipDate)) / 86400000);
    const daysEl = document.getElementById('cover-days');
    if (daysEl) daysEl.classList.remove('hidden');
    set('cover-days-num', days.toLocaleString());
  }

  // ── Page 2: Love Letter ─────────────────────────────────────
  const letter    = content.letter || '';
  const letterEl  = document.getElementById('mag-letter');
  if (letterEl && letter) {
    const paras = letter.split(/\n\n+/).filter(p => p.trim());
    letterEl.innerHTML = '';
    paras.forEach((p, i) => {
      const pEl = document.createElement('p');
      if (i === 0 && p.length > 0) {
        const first = p.charAt(0);
        const rest  = p.slice(1);
        pEl.innerHTML = `<span class="drop-cap">${esc(first)}</span>${esc(rest)}`;
      } else {
        pEl.textContent = p;
      }
      letterEl.appendChild(pEl);
    });
  }

  // ── Page 3: Photo Gallery ───────────────────────────────────
  const photosEl = document.getElementById('mag-photos');
  if (!images || images.length === 0) {
    show('no-photos');
  } else if (photosEl) {
    const rotations = [-3, 2, -1.5, 3.5, -2.5, 1];
    images.slice(0, 6).forEach((src, i) => {
      const caption = content.captions && content.captions.length > 0
        ? content.captions[i % content.captions.length]
        : null;
      const div = document.createElement('div');
      div.className = 'polaroid';
      div.style.setProperty('--rot', `${rotations[i % rotations.length]}deg`);
      div.innerHTML = `
        <img src="${src}" alt="Memory ${i + 1}" loading="lazy"/>
        ${caption ? `<div class="polaroid-caption">${esc(caption)}</div>` : ''}
      `;
      photosEl.appendChild(div);
    });
  }

  // ── Page 4: Our Story ───────────────────────────────────────
  buildMagTimeline(formData.timeline, content.timelineCaptions);

  // ── Page 5: Why I Love You ──────────────────────────────────
  const reasonsEl = document.getElementById('mag-reasons');
  if (reasonsEl) {
    (content.reasons || []).forEach((r, i) => {
      const div = document.createElement('div');
      div.className = 'mag-reason-item';
      div.innerHTML = `<span class="mag-reason-num">${i + 1}</span><span class="mag-reason-text">${esc(r)}</span>`;
      reasonsEl.appendChild(div);
    });
  }

  // ── Page 6: Poem ────────────────────────────────────────────
  const poemEl = document.getElementById('mag-poem');
  if (poemEl) poemEl.textContent = content.poem || '';

  // ── Page 7: Our Song ────────────────────────────────────────
  if (!formData.song) {
    const songBody = document.getElementById('mag-song-body');
    if (songBody) songBody.classList.add('hidden');
    show('no-song');
  } else {
    set('mag-song-name', formData.song);
    set('mag-song-note', content.songNote || '');
    const videoId = extractYouTubeId(formData.songUrl);
    if (videoId) {
      const ytWrap = document.getElementById('mag-yt-wrap');
      if (ytWrap) {
        ytWrap.classList.remove('hidden');
        ytWrap.innerHTML = `
          <div class="yt-poster" data-vid="${videoId}" onclick="playYouTubeInMag(this)">
            <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="Play ${esc(formData.song)}"/>
            <div class="yt-play-overlay"><span>&#9654;</span></div>
          </div>`;
      }
    }
  }

  // ── Page 8: Bucket List ─────────────────────────────────────
  const bucketEl   = document.getElementById('mag-bucket');
  const bucketList = content.bucketList || [];
  if (bucketEl) {
    if (bucketList.length === 0) {
      bucketEl.innerHTML = '<li class="bucket-item"><span class="bucket-check">🌟</span><span>Adventures await…</span></li>';
    } else {
      bucketList.forEach(item => {
        const li = document.createElement('li');
        li.className = 'bucket-item';
        li.innerHTML = `<span class="bucket-check">☐</span><span>${esc(item)}</span>`;
        bucketEl.appendChild(li);
      });
    }
  }

  // ── Page 9: Final Message ───────────────────────────────────
  set('mag-final', content.finalMessage || '');

  // ── Page 10: Back Cover ─────────────────────────────────────
  const backGrad = document.getElementById('cover-gradient-back');
  if (backGrad) backGrad.style.background = grad;
}

// ═══════════════════════════════════════════════════════════════
//  MAGAZINE — StPageFlip init
// ═══════════════════════════════════════════════════════════════
function initMagazine() {
  const container = document.getElementById('magazine');
  if (!container) return;

  // StPageFlip is loaded synchronously via CDN in the <head>
  if (!window.St || !window.St.PageFlip) {
    console.error('StPageFlip library not loaded');
    return;
  }

  pageFlip = new St.PageFlip(container, {
    width:               550,
    height:              733,
    size:                'stretch',
    minWidth:            280,
    maxWidth:            620,   // single-page cap — 2-page spread stays ≤ 1240px
    minHeight:           380,
    maxHeight:           900,
    showCover:           true,
    mobileScrollSupport: false,
    usePortrait:         true,
    startPage:           0,
    drawShadow:          true,
    flippingTime:        800,
    useMouseEvents:      true,
  });

  pageFlip.loadFromHTML(document.querySelectorAll('.page'));

  totalPages = document.querySelectorAll('.page').length;

  pageFlip.on('flip', e => updatePageIndicator(e.data));
  pageFlip.on('changeState', () => {
    const idx = pageFlip.getCurrentPageIndex();
    updatePageIndicator(idx);
  });

  updatePageIndicator(0);

  // Re-calculate layout on resize / fullscreen toggle
  let _resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => { if (pageFlip) pageFlip.update(); }, 120);
  });
}

function updatePageIndicator(pageIndex) {
  const el = document.getElementById('page-indicator');
  if (el) el.textContent = `${pageIndex + 1} / ${totalPages}`;

  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (prevBtn) prevBtn.classList.toggle('mag-nav-disabled', pageIndex === 0);
  if (nextBtn) nextBtn.classList.toggle('mag-nav-disabled', pageIndex >= totalPages - 1);
}

function magPrev() {
  if (pageFlip) pageFlip.flipPrev('bottom');
}

function magNext() {
  if (pageFlip) pageFlip.flipNext('bottom');
}

function magGoTo(pageIndex) {
  if (pageFlip) pageFlip.turnToPage(pageIndex);
}

// ── Heart QR ──────────────────────────────────────────────────
function toggleQR() {
  const panel = document.getElementById('qr-panel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !isHidden);
  if (isHidden) {
    const img = document.getElementById('heart-qr-img');
    if (img && !img.src.includes('/api/qr/')) {
      img.src = `${window.location.origin}/api/qr/${giftId}`;
    }
  }
}

async function downloadHeartQR() {
  try {
    const url = `${window.location.origin}/api/qr/${giftId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `heart-qr-${giftId}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('QR code downloaded! 💝');
  } catch {
    showToast('Could not download — try again');
  }
}

function showToast(msg) {
  let toast = document.getElementById('qr-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'qr-toast';
    toast.className = 'qr-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('qr-toast-visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('qr-toast-visible'), 2800);
}

function playYouTubeInMag(el) {
  const vid = el.dataset.vid;
  if (!vid) return;
  el.outerHTML = `<div class="mag-yt-iframe-wrap">
    <iframe src="https://www.youtube.com/embed/${vid}?autoplay=1"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen frameborder="0"></iframe>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  MAGAZINE TIMELINE
// ═══════════════════════════════════════════════════════════════
function buildMagTimeline(timeline, captions) {
  const c = document.getElementById('mag-timeline');
  if (!c) return;
  if (!timeline || timeline.length === 0) {
    c.innerHTML = '<p class="mag-empty-msg">Your story is still being written… 💫</p>';
    return;
  }
  timeline.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'mag-tl-item';
    div.innerHTML = `
      <div class="mag-tl-dot">💗</div>
      <div class="mag-tl-body">
        <div class="mag-tl-date">${formatDate(item.date)}</div>
        <div class="mag-tl-event">${esc(item.event)}</div>
        ${captions && captions[i] ? `<div class="mag-tl-note">${esc(captions[i])}</div>` : ''}
      </div>`;
    c.appendChild(div);
  });
}

// ═══════════════════════════════════════════════════════════════
//  YOUTUBE ID
// ═══════════════════════════════════════════════════════════════
function extractYouTubeId(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

// ═══════════════════════════════════════════════════════════════
//  CONFETTI
// ═══════════════════════════════════════════════════════════════
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx    = canvas.getContext('2d');
  const hearts = ['💝','💖','💗','🌸','✨','💕','🎉'];

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
    decay: Math.random() * 0.010 + 0.005,
  }));

  const DURATION = 4000;
  const startTs  = performance.now();
  let   rafId;

  function draw(now) {
    if (now - startTs > DURATION) { cancelAnimationFrame(rafId); canvas.style.display = 'none'; return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = 0;
    for (const p of pieces) {
      if (p.alpha <= 0) continue;
      alive++;
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.font = `${p.size}px serif`;
      ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillText(p.emoji, -p.size / 2, p.size / 2);
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.angle += p.spin; p.alpha -= p.decay;
    }
    if (alive > 0) rafId = requestAnimationFrame(draw);
    else canvas.style.display = 'none';
  }
  rafId = requestAnimationFrame(draw);
}

// ═══════════════════════════════════════════════════════════════
//  BACKGROUND STICKERS
// ═══════════════════════════════════════════════════════════════
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
  const emojis   = emojiSets[occasion] || ['💝','💖','💗','🌸','✨'];
  const COUNT    = 20;
  const vh       = window.innerHeight;
  const initTs   = performance.now();
  const travelPx = vh + 80;

  const stickers = Array.from({ length: COUNT }, () => {
    const el       = document.createElement('div');
    el.className   = 'bg-sticker';
    const size     = Math.random() * 16 + 16;
    const x        = Math.random() * 100;
    const duration = (Math.random() * 20 + 15) * 1000;
    const opacity  = +(Math.random() * 0.3 + 0.2).toFixed(2);
    const phase    = Math.random() * duration;
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = `left:${x}vw;bottom:${-size}px;font-size:${size}px;will-change:transform,opacity;`;
    document.body.appendChild(el);
    return { el, duration, phase, opacity };
  });

  function tick(ts) {
    const elapsed = ts - initTs;
    for (const s of stickers) {
      const progress = ((elapsed + s.phase) % s.duration) / s.duration;
      const y        = -(progress * travelPx);
      const alpha    = progress > 0.7 ? s.opacity * (1 - (progress - 0.7) / 0.3) : s.opacity;
      s.el.style.transform = `translateY(${y}px)`;
      s.el.style.opacity   = alpha;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
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
  if (!reactions || reactions.length === 0) { if (el) el.innerHTML = ''; return; }
  if (el) el.innerHTML = reactions.map(r =>
    `<div class="reaction-pill">${r.emoji}${r.message ? ' · ' + esc(r.message) : ''}</div>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════════
//  COPY LINK
// ═══════════════════════════════════════════════════════════════
function copyLink() {
  const btn      = document.getElementById('copy-link-btn');
  const shareUrl = `${window.location.origin}/gift/${giftId}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '🔗 Share this gift'; btn.classList.remove('copied'); }, 2500);
  });
}

// ═══════════════════════════════════════════════════════════════
//  PDF (legacy — kept for print media query)
// ═══════════════════════════════════════════════════════════════
function downloadPDF() {
  window.print();
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
window.unlockGift      = unlockGift;
window.copyLink        = copyLink;
window.downloadPDF     = downloadPDF;
window.sendReaction    = sendReaction;
window.submitReaction  = submitReaction;
window.magPrev         = magPrev;
window.magNext         = magNext;
window.magGoTo         = magGoTo;
window.playYouTubeInMag = playYouTubeInMag;
window.toggleQR         = toggleQR;
window.downloadHeartQR  = downloadHeartQR;

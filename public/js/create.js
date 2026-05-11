'use strict';

const fileInput    = document.getElementById('images');
const previewsGrid = document.getElementById('image-previews');
const uploadArea   = document.getElementById('upload-area');
let selectedFiles  = [];

fileInput.addEventListener('change', e => addFiles(Array.from(e.target.files)));
uploadArea.addEventListener('dragover',  e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files));
});

function addFiles(f) {
  f = f.filter(x => x.type.startsWith('image/'));
  const tooBig = f.filter(x => x.size > 15 * 1024 * 1024);
  if (tooBig.length) {
    alert(`${tooBig.length} photo(s) are over 15 MB and were skipped. Please compress them first.`);
    f = f.filter(x => x.size <= 15 * 1024 * 1024);
  }
  const slots = 5 - selectedFiles.length;
  if (!slots) return;
  selectedFiles = [...selectedFiles, ...f.slice(0, slots)];
  renderPreviews();
}

function renderPreviews() {
  previewsGrid.innerHTML = '';
  selectedFiles.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const d = document.createElement('div');
    d.className = 'preview-item';
    d.innerHTML = `<img src="${url}" alt="Preview ${i+1}"/><button class="preview-remove" data-i="${i}">✕</button>`;
    previewsGrid.appendChild(d);
  });
  previewsGrid.querySelectorAll('.preview-remove').forEach(btn =>
    btn.addEventListener('click', () => { selectedFiles.splice(+btn.dataset.i, 1); renderPreviews(); })
  );
}

// Password toggle
document.getElementById('passwordToggle').addEventListener('change', function () {
  const f = document.getElementById('password-field');
  if (this.checked) f.classList.remove('hidden');
  else { f.classList.add('hidden'); document.getElementById('password').value = ''; }
});

// ── Character counts ──────────────────────────────────────────
const charFields = [
  { id: 'memory1', countId: 'memory1-count', max: 200 },
  { id: 'memory2', countId: 'memory2-count', max: 200 },
  { id: 'memory3', countId: 'memory3-count', max: 200 },
  { id: 'trait1',  countId: 'trait1-count',  max: 150 },
  { id: 'trait2',  countId: 'trait2-count',  max: 150 },
  { id: 'trait3',  countId: 'trait3-count',  max: 150 },
];

charFields.forEach(({ id, countId, max }) => {
  const input = document.getElementById(id);
  const counter = document.getElementById(countId);
  if (!input || !counter) return;

  function update() {
    const len = input.value.length;
    counter.textContent = `${len} / ${max}`;
    counter.classList.toggle('warn',   len >= max * 0.8 && len < max * 0.95);
    counter.classList.toggle('danger', len >= max * 0.95);
  }
  input.addEventListener('input', update);
});

// ── Inspiration hint buttons ──────────────────────────────────
document.querySelectorAll('.inspiration-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const example  = document.getElementById(targetId);
    if (!example) return;
    const isOpen = example.classList.contains('open');
    // Close all others first
    document.querySelectorAll('.inspiration-example.open').forEach(el => el.classList.remove('open'));
    if (!isOpen) example.classList.add('open');
  });
});

// ── Form section entrance animations ─────────────────────────
const sectionObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.08 });

document.querySelectorAll('.form-section').forEach((el, i) => {
  el.style.transitionDelay = `${i * 0.04}s`;
  sectionObs.observe(el);
});

// ── Loading messages ──────────────────────────────────────────
const msgs = [
  'Reading your beautiful memories…',
  'Choosing the perfect words…',
  'Writing your love letter…',
  'Composing a poem just for them…',
  'Crafting your timeline…',
  'Adding the finishing touches…',
  'Almost ready…',
];
let mIdx = 0, mTimer;

function cycleMessages() {
  const el = document.getElementById('loading-msg');
  mTimer = setInterval(() => {
    mIdx = (mIdx + 1) % msgs.length;
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = msgs[mIdx]; el.style.opacity = '1'; }, 300);
    el.style.transition = 'opacity .3s';
  }, 3200);
}

// ── Submit — redirect to pay gate ────────────────────────────
document.getElementById('gift-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('form-error');
  err.classList.add('hidden');

  const fd = new FormData(e.target);
  fd.delete('images');
  selectedFiles.forEach(f => fd.append('images', f));

  document.getElementById('loading-overlay').classList.remove('hidden');
  cycleMessages();

  try {
    const res  = await fetch('/api/create', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong.');
    window.location.href = `/pay.html?id=${data.giftId}`;
  } catch (ex) {
    document.getElementById('loading-overlay').classList.add('hidden');
    clearInterval(mTimer);
    err.textContent = ex.message;
    err.classList.remove('hidden');
    window.scrollTo({ top: err.offsetTop - 20, behavior: 'smooth' });
  }
});

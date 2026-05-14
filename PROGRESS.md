# Project Progress — Digital Love Gift

A web app where you create a personalised digital gift (photos, music, message)
for someone special. They receive a heart-shaped QR code to scan and unlock it.

---

## Stack
- **Framework:** Next.js (App Router)
- **Database:** (lib/db.js — see source)
- **AI:** Claude API (`src/lib/ai.js`)
- **Image hosting:** Cloudinary
- **Payments:** Stripe
- **Deployment:** Vercel → `lovedigitalgift.com`

---

## Change Log

### 2026-05-14 — Heart-shaped QR code (matches viral TikTok style)
- **File:** `src/app/api/qr/[id]/route.js`
- Replaced logo-overlay approach with a true heart-shaped QR.
- Uses `QRCode.create()` to get the raw module matrix, then checks each dark
  module against the algebraic heart curve `(x²+y²−1)³ − x²y³ ≤ 0`.
- Only modules whose centre falls inside the heart are rendered (hot pink `#c8185a`).
- ECC level H (30 % loss tolerance) keeps the code scannable even with ~10–15 %
  of edge modules clipped by the heart boundary.

### 2026-05-14 — Simplify QR (remove decorations)
- Stripped card background, subtitle text and decorative border from QR image.
- Just the QR code itself with a heart logo in the centre — clean and minimal.

### 2026-05-13 — iOS scroll fix
- `stopPropagation` on touch events inside `.page-inner-scroll` so the flip-book
  swipe gesture doesn't hijack vertical content scrolling on iPhone.

### 2026-05-13 — Heart logo QR + iOS scroll (touch-action)
- Added a solid heart SVG composited over the centre of the QR (ECC H absorbs it).
- Applied `touch-action: pan-y` to scrollable inner pages to fix iOS overscroll.

### 2026-05-13 — Rose/pink QR colours
- Switched QR module colour from black to deep rose-red (`#8b1a2f`) to match brand.
- Used `QRCode.toBuffer()` + `sharp` composite for reliable server-side rendering.

### 2026-05-13 — Mobile layout fixes
- Enabled page scroll on iOS.
- Tighter layout, smaller nav arrows, better spacing on small screens.

### 2026-05-13 — QR cache TTL
- Reduced `Cache-Control` from a long TTL to 5 minutes to avoid stale QR images
  after a gift is updated.

### 2026-05-13 — QR scanning reliability
- Switched to black modules for maximum contrast (iPhone camera was struggling
  with coloured modules).
- Replaced SVG rasterization path with `qrcode.toBuffer()` + `sharp` composite.

### 2026-05-13 — QR code not scanning on iPhone
- Kept all modules intact (no centre cutout) so finder patterns are never broken.

### 2026-05-13 — "Create your own" CTA on QR image
- Added a subtle "Create your own gift" call-to-action text and back-cover branding
  to the QR PNG.

### Earlier — Upload fix (Vercel body limit)
- **File:** `src/app/api/upload-image/route.js`
- Images were uploaded one-at-a-time to stay under Vercel's 4.5 MB body limit.

### Earlier — Create route fixes
- Always returns JSON.
- Added step-level logging.
- Fixed Claude model name reference.
- Raised body size limit in Next.js config.

### Earlier — iOS date input validation
- Fixed a validation error triggered by the native iOS date picker on the create form.

### Earlier — Magazine flip-book gift viewer
- **File:** `src/app/gift/[id]/page.js`
- Complete redesign of the gift viewer as a page-flip magazine.
- Added heart QR code page, photo pages, message page.
- Fixed image uploads throughout.

### Earlier — OG meta tags + share URLs
- Added Open Graph tags so shared links show a preview image on WhatsApp/iMessage.
- Middleware to normalise URLs.
- Fixed share URL generation to use the production domain.

### Earlier — Payments, reply modal, music player
- Stripe checkout integration (`src/app/api/checkout/route.js`, webhook).
- Recipients can send a reply message back.
- Background music player on the gift viewer.

### Earlier — First commit
- Next.js scaffold, Cloudinary upload, AI message generation, basic gift flow,
  password-protected unlock, Stripe skeleton.

---

## Known / Watched
- Heart QR bottom-left finder pattern is partially clipped by the heart curve —
  tolerated by ECC H but worth monitoring if scan failures are reported.
- Vercel free-tier body limit (4.5 MB) constrains multi-image uploads; current
  one-at-a-time workaround is in place.

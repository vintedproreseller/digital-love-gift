# 💝 Digital Love Gift — Next.js Edition

A beautiful AI-powered romantic gift creator. Built with Next.js 14, SQLite (local), and Claude.

## Local Setup (5 minutes)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
```
Edit `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
Get a key at: https://console.anthropic.com

### 3. Run the dev server
```bash
npm run dev
```

### 4. Open in browser
```
http://localhost:3000
```

That's it. No database setup needed — SQLite creates itself automatically in `data/gifts.db`.

---

## Project Structure

```
digital-love-gift/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── create/route.js          # POST: create gift
│   │   │   └── gift/[id]/
│   │   │       ├── route.js             # GET: fetch gift
│   │   │       ├── unlock/route.js      # POST: password unlock
│   │   │       ├── react/route.js       # POST: add reaction
│   │   │       └── reactions/route.js   # GET: fetch reactions
│   │   ├── gift/[id]/page.js            # /gift/:id → gift.html?id=:id
│   │   ├── create/page.js               # /create → create.html
│   │   └── page.js                      # / → index.html
│   └── lib/
│       ├── db.js                        # SQLite (better-sqlite3)
│       ├── ai.js                        # Anthropic Claude
│       └── password.js                  # SHA-256 hashing
├── public/
│   ├── index.html                       # Landing page
│   ├── create.html                      # Gift creation form
│   ├── gift.html                        # Gift viewer
│   ├── css/style.css
│   ├── js/{main,create,gift}.js
│   └── uploads/                         # Uploaded images (local)
├── data/
│   └── gifts.db                         # SQLite DB (auto-created)
└── scripts/
    └── migrate.js
```

---

## Deploying to Production (Vercel + Neon)

### 1. Push to GitHub
```bash
git init && git add . && git commit -m "init"
gh repo create digital-love-gift --public --push
```

### 2. Create Neon database
- Sign up at https://neon.tech (free)
- Create a project, copy the `DATABASE_URL`

### 3. Create Cloudinary account
- Sign up at https://cloudinary.com (free, 25GB)
- Get your `CLOUDINARY_URL` or API key

### 4. Deploy to Vercel
```bash
npx vercel
```
Add environment variables in the Vercel dashboard:
- `ANTHROPIC_API_KEY`
- `DATABASE_URL` (your Neon URL)
- `CLOUDINARY_URL` (when you add Cloudinary)

### 5. Swap SQLite → Postgres
In `src/lib/db.js`, replace better-sqlite3 with the `pg` package:
```js
// Just change the driver — all your queries stay the same
// because we used a simple key-value style API
```
(Full migration guide: run `npm run db:migrate:postgres`)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Landing page |
| GET | `/create.html` | Gift creation form |
| GET | `/gift.html?id=:id` | View a gift |
| POST | `/api/create` | Create gift (multipart) |
| GET | `/api/gift/:id` | Fetch gift JSON |
| POST | `/api/gift/:id/unlock` | Unlock with password |
| POST | `/api/gift/:id/react` | Add emoji reaction |
| GET | `/api/gift/:id/reactions` | Get reactions |

---

Made with 💝

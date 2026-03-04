# Health Tracker

A simple web app to track health data (weight, steps, mood, sleep) using **Next.js**, **TypeScript**, and **Supabase** (PostgreSQL) with **Prisma**.

---

## What’s in this project

- **Next.js 14** (App Router) with **TypeScript**
- **Tailwind CSS** for styling
- **Supabase** for the database (hosted PostgreSQL—no local DB setup)
- **Prisma** as the ORM talking to Supabase
- Database tables: `HealthEntry`, `User` (Oura tokens), `OAuthState`
- API routes: `GET /api/health`, `POST /api/health`, `GET /api/oura/connect`, `GET /api/oura/callback`
- **Oura OAuth v2** – connect your Oura ring; tokens stored per user in Postgres
- Supabase Auth for "current user" (sign in at `/login`)

---

## Prerequisites

1. **Node.js** (v18 or v20 recommended)  
   - Check: `node -v`  
   - Install from [nodejs.org](https://nodejs.org) if needed.

2. **A Supabase account** (free tier is enough)  
   - Sign up at [supabase.com](https://supabase.com).

3. **npm** (comes with Node): `npm -v`

---

## Step 1: Install dependencies

From the project root (`health-tracker`):

```bash
cd health-tracker
npm install
```

- **What it does:** Installs Next.js, React, Prisma, Tailwind, TypeScript, and other packages listed in `package.json`.

---

## Step 2: Create a Supabase project and get the database URL

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.

2. Click **New project**:
   - Pick an organization (or create one).
   - Choose a **name** and a **database password** (save this—you’ll need it for `.env`).
   - Pick a region and click **Create new project**. Wait until the project is ready.

3. Get the connection string:
   - Click **Connect** on your project (or **Project Settings** → **Database**).
   - Under **Connection string** → **URI**, copy the **Session** mode string (port **5432**).
   - The host must be **`….pooler.supabase.com`** (not `db.xxxxx.supabase.co`—that one is not reachable from your computer).
   - Example format:
     ```
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
     ```

4. Create your `.env` file:

   ```bash
   cp .env.example .env
   ```

   Open `.env` and set `DATABASE_URL` to the URL you copied. **Replace `[YOUR-PASSWORD]`** with the database password you set when creating the project. The rest of the URL (project ref, region) is already in the string you copied.

   Add at the end: `?sslmode=require&connect_timeout=30&connection_limit=1`

   Example (with a fake password):

   ```env
   DATABASE_URL="postgresql://postgres.abcdefghij:mySecretPassword123@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30&connection_limit=1"
   ```

---

## Step 3: Create tables with Prisma

Generate the Prisma client and push the schema to the database:

```bash
npm run db:generate
npm run db:push
```

- **`db:generate`** – generates the TypeScript client from `prisma/schema.prisma` so you can use `prisma.healthEntry.create()`, etc.  
- **`db:push`** – creates or updates tables in your Supabase database to match the schema. For production you’d typically use `npm run db:migrate` instead.

---

## Step 4: Run the app

Start the Next.js dev server:

```bash
npm run dev
```

- Open [http://localhost:3000](http://localhost:3000).  
- You should see the Health Tracker page: add entries (weight, steps, mood, sleep) and they’ll be saved to your Supabase database and listed below. You can also open **Table Editor** in the Supabase dashboard to see the `health_entries` table.

---

## Useful commands (reference)

| Command | What it does |
|--------|----------------|
| `npm run dev` | Start dev server at http://localhost:3000 |
| `npm run build` | Build for production |
| `npm run start` | Run production build (run `build` first) |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:push` | Sync schema to DB (dev; no migration history) |
| `npm run db:migrate` | Create and run a migration (use for real migrations) |
| `npm run db:studio` | Open Prisma Studio to view/edit data in the browser |

---

## Project structure (simplified)

```
health-tracker/
├── app/
│   ├── api/health/route.ts   # GET and POST for health entries
│   ├── api/oura/
│   │   ├── connect/route.ts  # Redirects to Oura authorize URL
│   │   └── callback/route.ts # Exchanges code for tokens, saves to User
│   ├── globals.css
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/
│   ├── HealthTrackerClient.tsx  # Form + list (client component)
│   └── OuraConnect.tsx          # Connect Oura button
├── lib/
│   ├── prisma.ts             # Single Prisma client instance
│   └── supabase/
│       ├── client.ts         # Browser Supabase client
│       └── server.ts         # Server Supabase client (cookies)
├── prisma/
│   └── schema.prisma         # Database schema
├── .env                      # Your DATABASE_URL (not in git)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Oura OAuth setup

1. **Supabase Auth** – Add to `.env` (from Dashboard → Settings → API):
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

2. **Oura app** – Create an app at [api.ouraring.com/oauth/applications](https://api.ouraring.com/oauth/applications). Add redirect URI: `http://localhost:3000/api/oura/callback` (or your production URL).

3. **Env vars** – Add to `.env`:
   ```env
   OURA_CLIENT_ID="your-client-id"
   OURA_CLIENT_SECRET="your-client-secret"
   ```

4. **Tables** – Run `npm run db:push` to create `users` and `oauth_states`. Or run `supabase-oura-tables.sql` in Supabase SQL Editor.

5. **Flow** – Sign up at `/login` (Supabase Email auth must be enabled in Dashboard → Authentication → Providers). Then click **Connect Oura** on the home page. You’ll be redirected to Oura to authorize; after approval, tokens are saved to the `users` table.

---

## Next steps (ideas)

- Add more metric types or categories.  
- Use `prisma migrate dev` for versioned migrations.  
- Sync Oura data (sleep, activity) into the app using the stored access token.  
- Add charts (e.g. weight over time) with a library like Recharts.

---

## "Can't reach database" or connection errors

- **Use the pooler URL:** Host must be `….pooler.supabase.com` (e.g. `aws-0-us-east-1.pooler.supabase.com`), **not** `db.xxxxx.supabase.co`.
- **Session mode (port 5432):** In Connect / Database settings, copy the **Session** connection string (port 5432).
- **Project paused:** Free-tier projects pause after inactivity. In the Dashboard, if you see **Restore project**, click it and wait for the project to wake up.
- **Password:** If your database password contains `@`, `#`, `%`, etc., [URL-encode](https://www.urlencoder.org/) it in the connection string.
- **End the URL with:** `?sslmode=require&connect_timeout=30&connection_limit=1` (or `&sslmode=...` if the URL already has `?`).

If something doesn’t work, check that Node is installed, `.env` has the correct Supabase `DATABASE_URL` (with the real password), and that you’ve run `npm install`, `npm run db:generate`, and `npm run db:push`.

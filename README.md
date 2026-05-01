# SimpleCRM

A schema-agnostic data workspace that turns any JSON dataset into a filterable, searchable table with built-in CRM capabilities — status tracking, scoring, notes, tags, and bulk actions. Drop a Google Maps scrape today, a competitor list tomorrow, a product inventory next week — each lives in its own page with its own auto-detected schema.

Built for solo operators and small teams who routinely scrape, collect, or receive structured datasets and need to work through them systematically.

## Features

- **Auto-detected schema** — drop any JSON file and the system infers field types (phone, url, email, number, boolean, array, json, string), generates labels, and picks sensible title and dedup fields.
- **Type-aware rendering** — phones become click-to-call, URLs become external links, arrays become chips, booleans become check/X icons. Same data, different context: compact in the table, expanded in the detail panel.
- **Dynamic filters** — every visible field gets an appropriate filter control (substring, range, multi-select, has/missing) generated from the schema. Active filters surface as removable chips.
- **CRM layer on every record** — status (customizable per page), 1–5 score, append-only notes timeline, tags, and starred flag — independent of the underlying data shape.
- **Inline editing** with optimistic updates and silent rollback on failure.
- **Bulk actions** — set status / score / tag, delete across the current selection or every record matching active filters.
- **Detail panel** — slide-over with full record data, notes, tags, keyboard navigation (↑/↓ between rows, Esc to close), and an auto-detected "View on Maps" button when applicable.
- **Dedup on import** — phone-number and email normalization with `new_only` or `upsert` modes.
- **Multiple pages** — each dataset is its own page with its own schema, statuses, and emoji icon. Star the ones you use most; they pin to the top of the sidebar.
- **Dashboard** — totals, status distribution, per-page breakdown.
- **CSV export** that respects the current filter view.
- **Auth** — username/password (bcrypt) with JWT in an httpOnly, sameSite=strict cookie. No public registration; users are seeded via CLI.

## Tech stack

| Layer        | Choice                              |
| ------------ | ----------------------------------- |
| Framework    | Next.js 16 (App Router, Turbopack)  |
| Language     | TypeScript                          |
| UI           | Tailwind CSS v4, shadcn/ui          |
| Database     | MongoDB (Atlas) via Mongoose        |
| Auth         | `jose` (edge JWT) + `bcryptjs`      |
| Validation   | Zod                                 |
| Data fetching| SWR                                 |
| Runtime      | Bun (works with npm/pnpm too)       |

## Getting started

### Prerequisites

- Bun 1.2+ (or Node 20+)
- A MongoDB connection string (Atlas free tier is plenty)

### Setup

```bash
git clone https://github.com/DhruvRekhawat/simplecrm.git
cd simplecrm
bun install
```

Create `.env` in the project root:

```env
MONGO_URL=mongodb+srv://<user>:<pass>@<cluster>/?appName=Cluster0
DATABASE_NAME=simplecrm
JWT_SECRET=<generate with: openssl rand -hex 32>
```

Seed an admin user:

```bash
bun run seed -- --username admin --password <your-password>
```

Start the dev server:

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

## Scripts

| Command            | Purpose                              |
| ------------------ | ------------------------------------ |
| `bun run dev`      | Start the dev server (Turbopack)     |
| `bun run build`    | Production build                     |
| `bun run start`    | Run the production build             |
| `bun run typecheck`| Run `tsc --noEmit`                   |
| `bun run lint`     | Run ESLint                           |
| `bun run format`   | Format with Prettier                 |
| `bun run seed`     | Create or reset an admin user        |

## Project layout

```
app/
  api/                   REST endpoints (auth, pages, records, dashboard)
  dashboard/             Aggregated overview
  login/                 Sign-in page
  pages/                 Pages list and per-page workspace
components/
  layout/                App shell (sidebar, header)
  pages/                 Page cards, create/rename dialogs
  records/               Data table, filter bar, detail panel,
                         bulk toolbar, column settings, import modal,
                         field renderers (one per detected type)
  dashboard/             Status distribution bar
hooks/                   SWR hooks (use-pages, use-page, use-records)
lib/
  models/                Mongoose schemas (User, Page, Record)
  auth.ts                JWT sign/verify
  db.ts                  Mongoose singleton
  schema-detector.ts     JSON → typed schema
  dedup.ts               Phone/email/string normalizers
  filter-builder.ts      Schema + filter values → MongoDB query
  csv.ts                 Export helpers
middleware.ts            Auth guard
scripts/seed-user.ts     Admin user CLI
```

## Deployment

Built for one-click deploys to Vercel. Set `MONGO_URL`, `DATABASE_NAME`, and `JWT_SECRET` as environment variables in your Vercel project. MongoDB Atlas's free M0 tier handles tens of thousands of records comfortably.

## License

[MIT](./LICENSE) © Dhruv Rekhawat

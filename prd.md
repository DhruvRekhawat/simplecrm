# DataDesk — Product Requirements Document

**Version:** 1.0
**Author:** Dhruv / StardewLabs
**Date:** May 2026
**Status:** Draft

---

## 1. Overview

### 1.1 What is DataDesk?

DataDesk is a schema-agnostic data workspace that turns any JSON dataset into a filterable, searchable table with built-in CRM capabilities — status tracking, scoring, notes, and tags. It is not tied to any specific data shape. A user can drop a Google Maps scrape of 600 Lucknow salons today, a competitor analysis spreadsheet tomorrow, and a product inventory next week — each lives in its own "page" with its own auto-detected schema.

### 1.2 Problem Statement

Scraping tools like Apify produce structured JSON output that needs to be reviewed, filtered, annotated, and acted upon. Today this data lands in a spreadsheet, which lacks status tracking, note-taking, scoring, and multi-dataset management. Dedicated CRMs are overkill and force a fixed schema. There is no lightweight tool that sits between "raw JSON file" and "full CRM" — one that adapts its columns, filters, and rendering to whatever data you throw at it.

### 1.3 Target User

Solo operators and small teams who routinely scrape, collect, or receive structured datasets and need to work through them systematically — contacting leads, evaluating options, tracking progress. Primary persona: a founder running outreach campaigns across multiple verticals and geographies, where each campaign produces a different dataset shape.

### 1.4 Success Metrics

| Metric | Target |
|---|---|
| Time from JSON file to working filterable table | < 60 seconds |
| Time to update a lead's status | < 2 seconds (inline, no page navigation) |
| Datasets (pages) manageable per user | 50+ without performance degradation |
| Records per page | 5,000+ with sub-second filter/sort |

---

## 2. Core Concepts

### 2.1 Pages

A page is a named workspace that holds a single dataset. Each page has its own schema (auto-detected from imported data), its own status options, and its own records. Pages are the top-level organizational unit.

**Properties:**
- Name (user-defined, editable)
- Starred (boolean, for pinning important pages)
- Schema (array of field definitions — auto-detected, user-editable)
- Title field (which data field serves as the record's display name)
- Dedup field (which data field to use for duplicate detection)
- Status options (customizable list of statuses, defaults provided)
- Timestamps (created, last updated)

Pages are scoped to a user. There is no cross-user sharing in v1.

### 2.2 Records

A record is a single row of data within a page. It has two layers:

**Data layer (flexible):** The raw imported data, stored as an arbitrary key-value object. The keys and types vary per page based on the imported JSON. Examples: `{ title, phone, city, totalScore, categories }` for a Maps scrape, or `{ company, revenue, employees, industry }` for a company list.

**System layer (fixed):** CRM fields that exist on every record regardless of data shape:
- **Status** — one of the page's configured status options (default: new)
- **Score** — integer 1–5, or 0 for unscored
- **Notes** — append-only list of timestamped text entries
- **Tags** — array of user-defined string labels
- **Starred** — boolean for flagging individual records

### 2.3 Schema

A schema is an ordered array of field definitions that describes the structure of a page's data layer. It is auto-detected on first import and can be manually adjusted afterward.

**Each field definition contains:**
- `key` — the JSON key path (e.g., `"phone"`, `"location.lat"`)
- `label` — human-readable display name (auto-generated from key, editable)
- `type` — detected data type (see §3.2 for type system)
- `visible` — whether the column appears in the table
- `pinned` — whether the column is pinned to the left of the table

The schema evolves: subsequent imports to the same page may introduce new keys, which are appended to the schema with `visible: false` by default.

---

## 3. Schema Detection Engine

This is the core differentiator. The system must reliably infer a useful schema from arbitrary JSON without user configuration.

### 3.1 Detection Process

**Input:** An array of JSON objects (the imported dataset).

**Step 1 — Key extraction.** Iterate all objects, collect the union of all unique keys. For nested objects one level deep, flatten using dot notation: `location: { lat: 26.8 }` becomes key `location.lat`. Objects nested deeper than one level are treated as type `json` without further flattening.

**Step 2 — Type inference.** For each key, sample the value across all records (skipping null/undefined). Apply type detection rules in priority order:

| Priority | Condition | Detected Type |
|---|---|---|
| 1 | Value matches phone regex: starts with `+` or `(`, contains 7–15 digits after stripping separators | `phone` |
| 2 | Value is a string matching `^https?://` | `url` |
| 3 | Value is a string matching standard email regex | `email` |
| 4 | Value is a boolean | `boolean` |
| 5 | Value is a number (int or float) | `number` |
| 6 | Value is an Array | `array` |
| 7 | Value is an Object (and not flattened) | `json` |
| 8 | Default | `string` |

If a key has mixed types across records (e.g., some records have a number, others a string), fall back to `string`.

**Step 3 — Title field detection.** Select the first key whose name matches (case-insensitive): `title`, `name`, `company`, `business`, `label`, `heading`. If no match, use the first `string`-type field.

**Step 4 — Dedup field detection.** Select the first key whose name matches: `phone`, `email`, `placeId`, `place_id`, `id`. If no match, dedup is set to null (disabled).

**Step 5 — Label generation.** Convert each key to a display label:
- `camelCase` → split on uppercase boundaries → `"Camel Case"`
- `snake_case` → split on underscores → `"Snake Case"`
- `dot.notation` → use the last segment, apply above rules
- Known abbreviations preserved: `url` → `"URL"`, `id` → `"ID"`, `phone` → `"Phone"`

**Step 6 — Visibility defaults.** All fields are `visible: true` except: fields with type `json`, fields with key matching `placeId`, `place_id`, `countryCode`, `country_code` (metadata that clutters the table), and any field where >80% of records have null/empty values.

### 3.2 Type System — Rendering Rules

Each type maps to specific rendering behavior in three contexts: the table cell, the detail panel, and the filter bar.

**`string`**
- Table: plain text, truncated to 1 line with ellipsis
- Detail: full text
- Filter: search input (substring match, case-insensitive)

**`number`**
- Table: right-aligned, integers shown as-is, floats to 1 decimal
- Detail: formatted number
- Filter: min/max range inputs

**`phone`**
- Table: formatted display, clickable `tel:` link
- Detail: large click-to-call button, copy button
- Filter: has / doesn't have toggle

**`url`**
- Table: truncated to hostname, external link icon
- Detail: clickable "Open" button
- Filter: has / doesn't have toggle

**`email`**
- Table: clickable `mailto:` link
- Detail: clickable link, copy button
- Filter: has / doesn't have toggle

**`array`**
- Table: first 2 items as chips, "+N more" badge
- Detail: all items as chips
- Filter: multi-select dropdown (populated from distinct values across all records in the page)

**`boolean`**
- Table: green checkmark / red X icon
- Detail: toggle switch (read-only in v1)
- Filter: yes / no / all radio

**`json`**
- Table: collapsed `{...}` indicator
- Detail: expandable formatted JSON tree
- Filter: none

### 3.3 Schema Evolution

When a second (or subsequent) JSON file is imported to an existing page:

1. Detect schema of the new file.
2. Compare keys against existing page schema.
3. New keys are appended to the schema with `visible: false`.
4. A toast notification informs the user: "3 new columns detected: `fieldA`, `fieldB`, `fieldC`".
5. Existing keys are not modified (even if the new file has a different type for the same key — the original type wins).
6. Records from the new file that lack fields present in the schema render those cells as `—` (em dash).

---

## 4. Functional Requirements

### 4.1 Authentication

**FR-AUTH-01:** The system shall support username/password authentication.
**FR-AUTH-02:** Passwords shall be hashed with bcrypt (cost factor 12).
**FR-AUTH-03:** Sessions shall be managed via JWT stored in an httpOnly, secure, sameSite=strict cookie with a 7-day expiry.
**FR-AUTH-04:** All routes except `/login` and `/api/auth/*` shall require valid authentication.
**FR-AUTH-05:** Initial user creation shall be performed via a CLI seed script, not through a registration UI.
**FR-AUTH-06:** Failed login attempts shall return a generic "Invalid credentials" error without indicating whether the username or password was incorrect.

### 4.2 Pages

**FR-PAGE-01:** Users shall be able to create a new page by providing a name.
**FR-PAGE-02:** Users shall be able to rename a page via inline editing.
**FR-PAGE-03:** Users shall be able to star/unstar a page. Starred pages appear first in all listings.
**FR-PAGE-04:** Users shall be able to delete a page. Deletion cascades to all records within the page. A confirmation dialog is required.
**FR-PAGE-05:** Users shall be able to customize the list of status options for each page. Default statuses: `new`, `contacted`, `interested`, `not_interested`, `converted`, `junk`.
**FR-PAGE-06:** The pages list shall display each page's name, record count, status distribution summary, starred state, and last updated timestamp.

### 4.3 JSON Import

**FR-IMP-01:** Users shall be able to import data by dragging and dropping a `.json` file onto a drop zone or by clicking to browse for a file.
**FR-IMP-02:** The system shall accept JSON files containing an array of objects. A single object not wrapped in an array shall be auto-wrapped.
**FR-IMP-03:** On file selection, the system shall parse the JSON client-side and display: total record count, detected column count, and a preview of the first 5 rows.
**FR-IMP-04:** The import preview shall show the detected schema with: field key, detected type, generated label, and a visibility toggle. Users can adjust type, label, and visibility before confirming.
**FR-IMP-05:** The import preview shall allow the user to select the title field and dedup field from dropdowns.
**FR-IMP-06:** If the page already contains records and a dedup field is configured, the system shall check for duplicates and display: "X records in file, Y match existing records, Z new."
**FR-IMP-07:** When duplicates are found, the user shall choose between: "Import new only" or "Import & update existing."
**FR-IMP-08:** Import shall process records in batches of 500 with a progress bar.
**FR-IMP-09:** On completion, a toast shall display the import summary: inserted count, updated count, skipped count, and any new columns detected.
**FR-IMP-10:** Files larger than 10MB shall be parsed in a Web Worker to avoid blocking the main thread.

### 4.4 Data Table

**FR-TBL-01:** The data table shall render columns dynamically based on the page's schema, showing only fields marked as `visible`.
**FR-TBL-02:** System columns (starred, status, score) shall always appear as the last columns.
**FR-TBL-03:** Each cell shall render according to the field's type as defined in §3.2.
**FR-TBL-04:** Clicking a column header shall sort by that column (ascending → descending → no sort). A visual indicator shall show the current sort field and direction.
**FR-TBL-05:** The table shall paginate server-side with 50 records per page (configurable: 25, 50, 100).
**FR-TBL-06:** Status shall be editable inline via a dropdown in the table cell. Changes persist immediately via API call with optimistic UI update.
**FR-TBL-07:** Score shall be editable inline via clickable star icons (1–5). Changes persist immediately.
**FR-TBL-08:** Starred shall be toggleable inline via a star icon. Changes persist immediately.
**FR-TBL-09:** Clicking a row (outside of interactive elements) shall open the detail panel.
**FR-TBL-10:** Each row shall have a checkbox for bulk selection.
**FR-TBL-11:** Missing data (field exists in schema but not in this record) shall render as an em dash (`—`).

### 4.5 Dynamic Filters

**FR-FLT-01:** The filter bar shall be generated dynamically from the page's schema. Each visible field produces a filter control appropriate to its type (as defined in §3.2).
**FR-FLT-02:** Status filter (system) shall always be present as a multi-select.
**FR-FLT-03:** Score filter (system) shall always be present as a minimum-score selector.
**FR-FLT-04:** A text search input shall search across the title field value (substring, case-insensitive).
**FR-FLT-05:** Active filters shall display as removable chips above the table.
**FR-FLT-06:** A "Clear all filters" button shall reset all filters.
**FR-FLT-07:** Filter changes shall debounce for 300ms before triggering a server refetch.
**FR-FLT-08:** Array-type filter dropdowns shall be populated with distinct values from all records in the current page.
**FR-FLT-09:** Number-type range filters shall display the actual min/max from the dataset as placeholder values.

### 4.6 Detail Panel

**FR-DET-01:** The detail panel shall open as a slide-over drawer from the right side of the screen.
**FR-DET-02:** The panel header shall display the title field value, star toggle, status dropdown, and score stars.
**FR-DET-03:** The data section shall display all schema fields (including hidden ones) with their values rendered by type. Each field shows its label and value on a separate row.
**FR-DET-04:** Phone fields shall render as a prominent click-to-call button.
**FR-DET-05:** URL fields shall render as an "Open" button that opens in a new tab.
**FR-DET-06:** A Google Maps URL field (if present) shall render as a "View on Maps" button.
**FR-DET-07:** The tags section shall display existing tags as removable chips and provide an input to add new tags (comma-separated, Enter to submit).
**FR-DET-08:** The notes section shall display all notes in reverse chronological order (newest first). Each note shows text and a relative timestamp ("2 hours ago").
**FR-DET-09:** Users shall be able to add a new note via a textarea and submit button. Notes are append-only — no editing or deleting notes.
**FR-DET-10:** A "Delete record" button with confirmation dialog shall be available at the bottom of the panel.
**FR-DET-11:** Pressing Escape shall close the panel.
**FR-DET-12:** Up/down arrow keys shall navigate to the previous/next record while the panel is open.

### 4.7 Bulk Actions

**FR-BLK-01:** When one or more rows are selected via checkbox, a bulk action toolbar shall appear above the table.
**FR-BLK-02:** The toolbar shall display the count of selected records.
**FR-BLK-03:** Available bulk actions: Set Status (dropdown), Add Tag (input), Set Score (stars), Delete (with confirmation).
**FR-BLK-04:** A "Select all on this page" checkbox shall be available in the table header.
**FR-BLK-05:** When all rows on the current page are selected, an option to "Select all X records matching current filters" shall appear.

### 4.8 Column Settings

**FR-COL-01:** A column settings drawer shall be accessible from a gear icon in the page header.
**FR-COL-02:** The drawer shall list all schema fields with: drag handle for reordering, eye icon to toggle visibility, editable label text, and a type override dropdown.
**FR-COL-03:** Changes to column settings shall be saved to the page's schema and reflected immediately in the table.

### 4.9 Dashboard

**FR-DSH-01:** The dashboard shall display aggregate statistics across all of the user's pages.
**FR-DSH-02:** Summary cards: Total Records, Total Pages, % Contacted (status != new), % Converted.
**FR-DSH-03:** A status breakdown bar showing the distribution of records across statuses (all pages combined).
**FR-DSH-04:** A pages summary table showing: page name (linked), record count, status distribution mini-bar, last updated, star toggle. Starred pages pinned to top.

### 4.10 Export

**FR-EXP-01:** Users shall be able to export a page's records as CSV.
**FR-EXP-02:** The export shall respect current filters — only matching records are exported.
**FR-EXP-03:** Exported columns: all visible schema fields + system fields (status, score, tags as comma-separated string).
**FR-EXP-04:** Export shall be generated client-side and trigger an immediate download.
**FR-EXP-05:** The exported filename shall be `{page-name}_{date}.csv`.

---

## 5. Non-Functional Requirements

### 5.1 Performance

**NFR-PERF-01:** Table rendering with 50 records, 12 columns shall complete in under 200ms.
**NFR-PERF-02:** Filter/sort operations on a page with 5,000 records shall return in under 500ms.
**NFR-PERF-03:** JSON import of 1,000 records shall complete in under 10 seconds.
**NFR-PERF-04:** All inline edits (status, score, star) shall use optimistic updates — the UI reflects the change immediately, with a silent rollback on API failure.

### 5.2 Reliability

**NFR-REL-01:** Failed API calls for inline edits shall retry once automatically, then show an error toast with the option to retry.
**NFR-REL-02:** Import failures mid-batch shall not lose already-imported records. The system reports partial success: "412 of 603 imported, 191 failed."
**NFR-REL-03:** MongoDB connection shall use the singleton pattern to prevent connection pool exhaustion during Next.js hot reloads.

### 5.3 Security

**NFR-SEC-01:** All API routes (except auth) shall verify the JWT and scope queries to the authenticated user's data.
**NFR-SEC-02:** Page and record API routes shall verify that the requested resource belongs to the authenticated user. A user cannot access another user's pages or records by guessing IDs.
**NFR-SEC-03:** JWT secret shall be stored as an environment variable, never committed to source control.
**NFR-SEC-04:** JSON import shall validate that the parsed content is an array of plain objects. No prototype pollution vectors, no executable content.

### 5.4 Usability

**NFR-USE-01:** The app shall be responsive. On mobile (< 768px): sidebar collapses to a hamburger menu, table scrolls horizontally, detail panel opens full-width.
**NFR-USE-02:** All destructive actions (delete page, delete record, bulk delete) shall require a confirmation dialog.
**NFR-USE-03:** Empty states shall display helpful illustrations/text and a clear call-to-action (e.g., "Import some data to get started" with an import button).
**NFR-USE-04:** Loading states shall use skeleton placeholders, not spinners.

---

## 6. Technical Architecture

### 6.1 Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 14+ (App Router) | Full-stack, server components for initial load performance |
| Language | TypeScript | Type safety across the flexible schema system |
| UI | shadcn/ui + Tailwind CSS | Consistent, accessible components without library lock-in |
| Database | MongoDB (Atlas) | Schema flexibility is the core requirement — document model fits naturally |
| ODM | Mongoose | Mature, well-typed MongoDB integration for Next.js |
| Auth | jose + bcryptjs | Edge-compatible JWT (works in Next.js middleware), secure password hashing |
| Validation | Zod | Runtime type validation for API inputs and schema definitions |
| Deployment | Vercel + MongoDB Atlas Free Tier | Zero cost, zero ops |

### 6.2 Data Model

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│  users   │──1:N─│  pages   │──1:N─│  records │
│          │      │          │      │          │
│ username │      │ name     │      │ data:{…} │  ← flexible
│ passHash │      │ schema[] │      │ status   │  ← fixed system
│          │      │ starred  │      │ score    │     fields
│          │      │ titleFld │      │ notes[]  │
│          │      │ dedupFld │      │ tags[]   │
│          │      │ statuses │      │ starred  │
└──────────┘      └──────────┘      └──────────┘
```

### 6.3 API Design

All API routes are under `/api/`. All require authentication except `/api/auth/*`.

**Authentication**
```
POST   /api/auth/login          → Set JWT cookie
POST   /api/auth/logout         → Clear cookie
GET    /api/auth/me             → Current user
```

**Pages**
```
GET    /api/pages               → List all pages (with record counts via aggregation)
POST   /api/pages               → Create page
PATCH  /api/pages/:id           → Update name, starred, schema, statusOptions, titleField, dedupField
DELETE /api/pages/:id           → Delete page + cascade records
```

**Schema Detection**
```
POST   /api/pages/:id/detect-schema    → Detect schema from sample records (no writes)
```

**Records**
```
GET    /api/pages/:id/records          → Paginated, filtered, sorted records
POST   /api/pages/:id/records/import   → Bulk import with dedup
PATCH  /api/pages/:id/records/:rid     → Update system fields or data fields
DELETE /api/pages/:id/records/:rid     → Delete single record
POST   /api/pages/:id/records/bulk     → Bulk status/tag/score/delete
```

**Filters**
```
GET    /api/pages/:id/filters          → Distinct values and ranges for filter dropdowns
```

**Dashboard**
```
GET    /api/dashboard                  → Aggregated stats
```

### 6.4 MongoDB Indexes

```javascript
// Records — primary query pattern (list records in a page)
{ pageId: 1, status: 1 }

// Records — starred filter
{ pageId: 1, starred: -1 }

// Records — dedup lookups during import
// Created dynamically per page based on dedupField:
// e.g., { pageId: 1, "data.phone": 1 }

// Pages — user's pages list
{ userId: 1, starred: -1, updatedAt: -1 }
```

Wildcard indexes (`data.$**`) are deferred to a future optimization phase. At current scale (< 10,000 records per page), targeted queries using `data.{fieldKey}` with no index perform acceptably.

### 6.5 Deduplication Logic

Dedup runs during import when a dedup field is configured.

**Normalization by type:**
- `phone`: strip all whitespace, dashes, parentheses, dots. Normalize country code: `091`, `91`, `+91` all become `+91`. Compare the normalized string.
- `email`: lowercase, trim whitespace.
- `string` (generic): lowercase, trim whitespace.

**Process:**
1. Extract the dedup field value from each incoming record.
2. Normalize the value based on its type.
3. Query existing records in the page for matching normalized values (batch lookup).
4. Partition incoming records into "new" (no match) and "existing" (match found).
5. Based on user's chosen mode: insert new only, or insert new + update data on existing matches.

### 6.6 Project Structure

```
data-desk/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                        # → redirect /dashboard
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── pages/
│   │       ├── page.tsx                    # pages list
│   │       └── [pageId]/page.tsx           # records table
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── pages/
│   │   │   ├── route.ts
│   │   │   └── [pageId]/
│   │   │       ├── route.ts
│   │   │       ├── detect-schema/route.ts
│   │   │       ├── filters/route.ts
│   │   │       └── records/
│   │   │           ├── route.ts
│   │   │           ├── import/route.ts
│   │   │           ├── bulk/route.ts
│   │   │           └── [recordId]/route.ts
│   │   └── dashboard/route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── nav.tsx
│   │   ├── dashboard/
│   │   │   ├── stat-cards.tsx
│   │   │   ├── status-bar.tsx
│   │   │   └── pages-summary.tsx
│   │   ├── pages/
│   │   │   ├── page-card.tsx
│   │   │   ├── create-dialog.tsx
│   │   │   └── rename-dialog.tsx
│   │   ├── records/
│   │   │   ├── data-table.tsx
│   │   │   ├── filter-bar.tsx
│   │   │   ├── column-settings.tsx
│   │   │   ├── import-modal.tsx
│   │   │   ├── detail-panel.tsx
│   │   │   ├── bulk-toolbar.tsx
│   │   │   └── field-renderers/
│   │   │       ├── string-field.tsx
│   │   │       ├── phone-field.tsx
│   │   │       ├── url-field.tsx
│   │   │       ├── email-field.tsx
│   │   │       ├── number-field.tsx
│   │   │       ├── array-field.tsx
│   │   │       ├── boolean-field.tsx
│   │   │       ├── json-field.tsx
│   │   │       ├── status-cell.tsx
│   │   │       ├── score-cell.tsx
│   │   │       └── starred-cell.tsx
│   │   └── ui/                             # shadcn components
│   ├── lib/
│   │   ├── db.ts                           # mongoose singleton
│   │   ├── auth.ts                         # JWT sign/verify helpers
│   │   ├── models/
│   │   │   ├── user.ts
│   │   │   ├── page.ts
│   │   │   └── record.ts
│   │   ├── schema-detector.ts
│   │   ├── dedup.ts
│   │   ├── filter-builder.ts
│   │   └── label-generator.ts
│   ├── hooks/
│   │   ├── use-records.ts                  # SWR/React Query hook for records
│   │   ├── use-pages.ts
│   │   └── use-filters.ts
│   └── middleware.ts                       # auth guard
├── scripts/
│   └── seed-user.ts
├── .env.local
├── tailwind.config.ts
└── package.json
```

---

## 7. User Flows

### 7.1 First-Time Setup

1. Admin runs `npx tsx scripts/seed-user.ts --username admin --password <pass>`.
2. Admin navigates to app URL → redirected to `/login`.
3. Enters credentials → redirected to `/dashboard`.
4. Dashboard is empty: "No pages yet. Create your first page."

### 7.2 Import a New Dataset

1. User clicks "Create Page" → enters name "Lucknow Spas" → page created.
2. Page view loads with empty state: "Drop a JSON file here or click to browse."
3. User drags `apify-results.json` onto the drop zone.
4. System parses file: "603 records found, 12 columns detected."
5. Import preview shows detected schema. User scans columns, toggles off `countryCode` and `placeId`, confirms `title` as display field and `phone` as dedup field.
6. User clicks "Import 603 records."
7. Progress bar fills. Toast: "603 records imported."
8. Table loads with data. Filters populate with actual values (cities, categories).

### 7.3 Work Through Leads

1. User filters by city: "Lucknow", category: "Spa", minimum rating: 4.0.
2. Table shows 87 matching records.
3. User clicks first row → detail panel opens.
4. Sees phone number, clicks call button → phone dials.
5. After call, sets status to "contacted", adds note: "Spoke to owner, interested in gold chains, follow up next week."
6. Closes panel, moves to next record.
7. After processing 10 records, user bulk-selects 5 records with no phone number, sets status to "junk."

### 7.4 Import Additional Data to Existing Page

1. User runs a second Apify scrape with different search terms.
2. Opens "Lucknow Spas" page, clicks "Import JSON."
3. Drops new file: "450 records found."
4. System detects 2 new columns not in original schema. Shows dedup results: "450 in file, 180 match existing (by phone), 270 new, 2 new columns."
5. User selects "Import new only."
6. Toast: "270 records imported. 2 new columns added (hidden by default)."

### 7.5 Dashboard Review

1. User navigates to Dashboard.
2. Sees: 873 total records, 3 pages, 23% contacted, 4% converted.
3. Pages table shows "Lucknow Spas" (603 records), "Delhi Salons" (200 records), "Jaipur Wellness" (70 records) with status breakdown bars.
4. Clicks "Delhi Salons" → navigates to that page's table.

---

## 8. Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| Empty JSON array `[]` | Show error: "File contains no records." |
| Single object `{...}` (not array) | Auto-wrap in array, proceed normally. |
| Deeply nested objects (>1 level) | Flatten one level, treat deeper nesting as `json` type. |
| Records with inconsistent keys | Schema includes union of all keys. Missing values render as `—`. |
| Malformed JSON file | Parse error toast: "Could not parse file. Ensure it's valid JSON." |
| File > 10MB | Parse in Web Worker. Show "Processing large file..." indicator. |
| Duplicate page names | Allowed. Pages are identified by ID, not name. |
| Very long field values (>200 chars) | Truncate in table cell with title tooltip. Full value in detail panel. |
| Phone number with no country code | Store as-is. Dedup normalizes for comparison but doesn't modify stored value. |
| All records missing the dedup field | Dedup is skipped. All records imported as new. Warning toast. |
| API failure during inline edit | Optimistic update rolls back. Error toast with retry option. |
| Import interrupted (browser closed) | Already-inserted batches persist. User can re-import; dedup prevents duplicates. |
| Page deleted while records are loading | API returns 404. UI redirects to pages list with toast: "Page not found." |
| Schema field type manually changed | Existing data is not modified. Rendering switches to new type's renderer. If incompatible (e.g., string → number on non-numeric data), cell shows raw value as string fallback. |
| Status option removed from page config | Records with orphaned status show a gray badge with the old status text. No data loss. |
| Concurrent edits (multi-tab) | Last write wins. No real-time sync in v1. |

---

## 9. Future Considerations (Out of Scope for v1)

These are explicitly not being built now but are accounted for in the architecture so they can be added without rewriting.

- **Multi-user / teams:** Add an `orgId` to pages and records. Share pages across users within an org.
- **Real-time sync:** WebSocket layer for live updates when multiple users edit the same page.
- **Computed columns:** User-defined formulas (e.g., `fullAddress = street + ", " + city`).
- **Kanban view:** Records as cards grouped by status column, draggable between columns.
- **Map view:** For datasets with lat/lng, render records as map pins.
- **Automations:** "When status changes to contacted, add tag outreach-batch-1."
- **API / webhook integration:** Accept data from external sources via API, not just file upload.
- **Direct Apify integration:** Connect Apify account, select actor runs, import results directly without downloading JSON.
- **Custom scoring rules:** Per-page scoring formulas instead of manual 1–5.
- **Attachments:** Upload files (contracts, photos) to individual records.
- **Activity log:** Track who changed what, when (useful for multi-user).

---

## 10. Build Phases

| Phase | Scope | Effort |
|---|---|---|
| 1 — Scaffold + Auth | Project setup, MongoDB, login flow, protected routes, app shell | ~3 hours |
| 2 — Pages CRUD | Create, rename, star, delete pages. Pages list UI. | ~2 hours |
| 3 — Schema Detection + Import | Schema detector, import flow with preview and dedup, record model | ~6 hours |
| 4 — Dynamic Table | Type-aware table rendering, server-side pagination, filters, sort, inline editing | ~6 hours |
| 5 — Detail Panel + Bulk Actions | Slide-over panel, notes, tags, bulk operations, column settings | ~4 hours |
| 6 — Dashboard + Polish | Dashboard stats, CSV export, status customization, edge cases, mobile | ~4 hours |

**Total estimated effort: ~25 hours across 4–6 sessions.**

---

## 11. Deployment & Infrastructure

| Component | Service | Cost |
|---|---|---|
| Application | Vercel (Hobby or Pro) | Free / $20/mo |
| Database | MongoDB Atlas (M0 Free Tier, 512MB) | Free |
| Domain | Optional | ~$10/year |

The free tier supports the expected data volume (< 100,000 records total, < 100MB storage) comfortably. Upgrade to Atlas M10 ($57/mo) only if data exceeds 512MB or query performance degrades.

---

## Appendix A: Default Status Options

```
new              → Gray badge
contacted        → Blue badge
interested       → Amber badge
not_interested   → Red badge
converted        → Green badge
junk             → Dark gray badge
```

Users can add, remove, or rename statuses per page. Badge colors are assigned based on position in the list (rotating through a fixed color palette).

## Appendix B: Phone Number Normalization Examples

| Input | Normalized (for dedup) | Stored (display) |
|---|---|---|
| `+91 72678 60160` | `+917267860160` | `+91 72678 60160` |
| `91-7267860160` | `+917267860160` | `91-7267860160` |
| `07267860160` | `+917267860160` | `07267860160` |
| `(726) 786-0160` | `+17267860160` | `(726) 786-0160` |
| `7267860160` | `7267860160` | `7267860160` |

Note: 10-digit numbers without a country code are stored as-is. Country code inference (assuming +91 for Indian numbers) is not applied in v1 to avoid false matches.

## Appendix C: Supported JSON Structures

**Standard (expected):**
```json
[
  { "title": "Spa A", "phone": "+91..." },
  { "title": "Spa B", "phone": "+91..." }
]
```

**Single object (auto-wrapped):**
```json
{ "title": "Spa A", "phone": "+91..." }
```

**Nested one level (flattened):**
```json
[{ "name": "Spa", "location": { "lat": 26.8, "lng": 80.9 } }]
→ Schema keys: name, location.lat, location.lng
```

**Deeply nested (treated as json type):**
```json
[{ "meta": { "geo": { "coords": { "lat": 26.8 } } } }]
→ Schema key: meta (type: json, not flattened beyond one level)
```

**Inconsistent records (union of keys):**
```json
[
  { "name": "A", "phone": "123" },
  { "name": "B", "email": "b@x.com" }
]
→ Schema keys: name, phone, email
→ Record A: email renders as —
→ Record B: phone renders as —
```
# CASAMELIA QUOTATION SOFTWARE

Functional Next.js + React + TypeScript frontend and FastAPI backend, built from the original Casamelia workbook. Runs locally with SQLite; uses PostgreSQL for server deployment. No Excel application is required for daily work.

## Quick start on this Windows computer

The project is at `C:\Users\varun\casamelia-quotation`.

```powershell
cd C:\Users\varun\casamelia-quotation
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Open **http://localhost:3100**. The script installs dependencies, imports the source once, builds the frontend and starts both services. Keep its terminal open; Ctrl+C stops it. Internet is required only for installing dependencies. If another instance is already running on ports 3100 or 18080, use that instance or stop it first.

Development accounts:

| Role | Username | Password |
| --- | --- | --- |
| Admin | admin | admin123 |
| Sales Executive | sales | sales123 |

Passwords are hashed on the backend. They are not stored in frontend code. **My password** lets any user change their own password. Admin can reset passwords or create users in **Admin settings → User access**. Password changes revoke existing sessions.

## Manual local setup

Requires Node.js 22+, Python 3.14 and installed Calibri on Windows. Linux requires DejaVu Sans (`fonts-dejavu-core`).

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
.\.venv\Scripts\python -m backend.app.cli init
.\.venv\Scripts\python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 18080
```

In a second terminal:

```powershell
cd C:\Users\varun\casamelia-quotation\frontend
npm.cmd ci
$env:API_URL='http://127.0.0.1:18080'
npm.cmd run dev -- --port 3100
```

For a production frontend build locally:

```powershell
npm.cmd run build
$env:API_URL='http://127.0.0.1:18080'
$env:PORT='3100'
npm.cmd run start
```

`API_URL` is a server environment variable. The browser calls same-origin `/api/...`; database credentials and session tokens are never put in frontend JavaScript. The backend's API documentation is at http://127.0.0.1:18080/docs.

## Source files and initial import

The current catalogue comes from `backend/data/Qoute_1-10-2026.xlsx`, including all 13 sheets, the instructions, hidden Lists/MasterFlat data and formula-derived prices. [October source mapping](docs/OCTOBER_SOURCE_MAPPING.md) describes the extraction, calculations, relationships and warnings. `docs/new-source/` retains cell/formula values and the workbook XML. `backend/data/current-source.json` is the deterministic import data.

The current import contains **658 distinct item/specification combinations plus four explicitly unpriced door selections**, **nine areas**, **1,145 preserved source price records**, and **32 unresolved visible/hidden price conflicts**. The earlier 238 catalogue records, original source files, quotations and documents remain preserved. Legacy catalogue entries are inactive for new selection.

`Mr.Sumit_RevisedQuotation_070920261740.pdf` is a visual reference only. Its customer, project, measurements, rates, quantities and historical totals are never imported into the current master database or quotation calculations. The complete earlier 13 terms are retained, with the lifetime warranty wording specifically approved by the user. Company details/logo are retained from the earlier workbook. **Enter approved bank details in Admin Settings**; the PDF's business values are not imported.

`cli init` runs migrations and both idempotent imports. Existing prices, users and documents are not reset. Back up an existing database before upgrading. The local backup/upgrade helper is:

```powershell
.\.venv\Scripts\python scripts\upgrade_local_database.py
```

To rebuild the read-only inspection/extraction for the supplied October workbook:

```powershell
.\.venv\Scripts\python scripts\read_new_workbook.py
.\.venv\Scripts\python scripts\extract_current_source.py
.\.venv\Scripts\python scripts\inspect_reference_pdf.py
```

These scripts rebuild packaged source reports, not existing database prices. Their mappings target the supplied workbook structure. Review any new structure before changing the importer.

### Price conflicts and future imports

Admin must review **Master List → Price Conflicts**. Both original values remain stored. Choosing a source records the official price, actor, date and audit trail. Sales cannot use an unresolved combination, including through an override or direct API call.

Admin can manage products/specifications, measurement type, units, prices, areas and area/product assignments without changing code. Price history and original source records are available for each item. Unpriced source items require an explicit project rate and reason; no accessory price is invented. The workbook mentions Hafele discounts but supplies no base prices for those items.

**Master List → Import Excel** uploads a revised workbook, shows new items, price changes, conflicts, duplicates and removed items, and requires an explicit Apply action. Duplicate combinations block applying. A changed unresolved conflict also blocks applying until the existing conflict is reviewed. The upload and import report remain archived. This reviewed importer updates the **Master List sheet**; area-only specifications and relationships from revised area sheets must be reviewed through the Admin catalogue/Areas screens. That scope is shown in the preview.

## Create a quotation

1. Login and choose **New quotation**.
2. Select or save a customer, then enter project reference, address and date.
3. Select a catalogue area and enter its project section name, such as Bedroom 1.
4. Search applicable items and select an exact specification. The server supplies the approved Master Rate.
5. Quotation Rate defaults to Master Rate. Admin and Sales can change only this quotation's rate, with a reason. Master pricing stays unchanged.
6. Enter the item's measurement type, measurements and quantity. Custom/unpriced items need an explicit quotation rate and reason. Hardware allocation is available where required by the workbook.
7. Enter additional rate amounts and/or one-time charges when applicable. Review server-calculated totals and terms.
8. **Save draft** keeps incomplete work. **Generate quotation** validates and saves both documents, then opens the actual saved PDF in the application. Review it with page navigation, zoom and fit-to-width. **Download PDF** and **Download Excel** run only when clicked; generation never automatically downloads files.

Area calculation: `width × length × quantity × (quotation rate + rate addition) + one-time charge`. Running feet use the entered running length; unit items use quantity; fixed items use one unit. Hardware allocation follows `carcass rate + hardware amount / allocated area` with a recorded override reason. Defaults and specifications come from the workbook. GST defaults to 18% and is configurable. Decimal calculations round line amounts and GST to paise. Empty rows are excluded; incomplete configured rows receive validation messages.

Admin sees all quotations and can mark a generated quotation Finalized. Sales sees and edits their own quotations and customers. Both roles can override project rates; only Admin changes master prices/settings, manages areas or resolves global conflicts.

## PDF, editable Excel and immutable versions

PDF generation uses ReportLab on the backend, with selectable text, the Casamelia logo/header, blue two-level headers, yellow sections, green totals, borders, complete terms and signature areas. Output is A4 portrait. The reference PDF is US Letter; pagination is adapted to A4 and complete terms, rather than copying its clipped text.

Excel generation uses openpyxl with real editable cells, measurements, master/project rates, formulas, totals, terms and a separate saved snapshot sheet. It prints on A4 landscape to accommodate the additional editable columns. Open Excel to recalculate formulas automatically. Amount in words records the generated total; changes made outside the application do not update the saved quotation or its amount-in-words text. Regenerate through the application to create an approved new version.

Each generated version stores customer/project data, item specifications, master/project rates, override attribution, measurements, totals, GST, terms, company/bank details, logo and generation attribution, plus the **exact PDF and XLSX bytes**. Changing master prices, terms, bank details or branding cannot change saved files.

Editing a generated quotation creates a working revision under the same quotation number; generating it saves another document version. Earlier versions remain downloadable. **New quotation with current prices** explicitly creates a separate quotation using the current master prices, tax and terms. Existing quotations retain their pricing/terms when reopened.

Filenames are `Casamelia_Quotation_{QuotationNumber}.pdf` and `.xlsx`. Both documents are stored in the database and included in database backups. Legacy versions created before Excel support retain their PDF; generate an explicit new version to obtain Excel rather than reconstructing historical data from today's master.

## Configuration

The app does not require a JWT signing secret: it uses random opaque session tokens in HttpOnly cookies, with token hashes and expirations stored in the database. Production cookies use Secure and SameSite=Strict. Mutating API calls require `X-Casa-Request: 1`; browser origins are checked against the configured allowlist.

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Defaults to local SQLite; server example: `postgresql+psycopg://user:password@host:5432/casamelia` |
| API_URL | Next.js server's backend URL; local default `http://127.0.0.1:18080` |
| APP_ENV | `development` or `production`; production disables automatic startup seeding/schema creation |
| ALLOWED_ORIGINS | Comma-separated exact browser origins, including scheme and port |
| COOKIE_SECURE | true for HTTPS; production always uses Secure cookies |
| SESSION_HOURS | Session expiration; default 8 |
| ADMIN_PASSWORD / SALES_PASSWORD | Initial seed passwords; required for a fresh production database |
| PORT | Frontend listening port, default 3000 |

Development accepts localhost/127.0.0.1 on ports 3000, 3100 and 3101. Add your actual origin for any different port/domain. `.env.example` is for Docker Compose. For manual backend processes, export variables in the shell; they do not automatically read that root `.env` file. Next.js supports its standard server `.env.local` configuration.

To create the initial Admin/Sales accounts, set seed passwords before `cli init`. Once users exist, seed credentials never reset passwords. Use Admin settings to create additional accounts with either of the two supported roles.

## PostgreSQL and database migrations

Use a fresh PostgreSQL database for production, not a copied SQLite file. Set `DATABASE_URL`, then:

```powershell
.\.venv\Scripts\python -m alembic upgrade head
.\.venv\Scripts\python -m backend.app.cli init
```

For later schema changes, create and review a new Alembic migration. Do not alter an already deployed migration. Quotation numbers use an atomic per-year counter plus a unique database constraint. Updates use optimistic revision checks; stale edits receive HTTP 409.

## Production deployment with Docker

Docker and Compose must be installed on the target server. This environment has neither Docker nor PostgreSQL, so a live PostgreSQL/container deployment has not been executed here. The migration has been executed against SQLite, A live PostgreSQL migration and container deployment still require validation on the target server.

1. Copy `.env.example` to `.env`.
2. Set unique database, Admin and Sales passwords. Prefer a hex database password or URL-encode reserved characters used inside `DATABASE_URL`.
3. Set `ALLOWED_ORIGINS` to the real HTTPS domain.
4. Run:

```sh
docker compose up --build -d
```

Compose starts PostgreSQL, waits for its health check, runs migrations/import once, then starts the backend and frontend. PostgreSQL uses a persistent named volume. Backend/database ports are private. The frontend is bound to `127.0.0.1:3000` for an HTTPS reverse proxy.

Configure Nginx/Caddy to serve your HTTPS domain and proxy to `http://127.0.0.1:3000`. Example Nginx location inside an HTTPS server block:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 90s;
    client_max_body_size 5m;
}
```

Set up your TLS certificate, DNS, process monitoring and scheduled PostgreSQL backups on that server. Verify a full Admin and Sales workflow on the actual HTTPS domain before staff use. Development credentials are not suitable for production.

## Tests

Backend tests use isolated SQLite databases and do not change the application database:

```powershell
.\.venv\Scripts\python -m pytest backend\tests -q
```

Frontend checks:

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run build
```

Browser tests use installed Microsoft Edge by default. Use a **fresh isolated database** because the Admin test deliberately resolves one conflict. Start a backend on port 18081 with a new `DATABASE_URL` path, and the built frontend on port 3101 with `API_URL=http://127.0.0.1:18081` and `PORT=3101`. Then:

```powershell
npm.cmd run test:e2e
```

`E2E_BASE_URL` can change the test URL; also update `ALLOWED_ORIGINS` for a different port. The tests cover login, permissions, customer save, exact real product selection, measurement/rate/Other/totals, draft save, equal-rate and reset override states, generation without downloads, actual PDF preview, explicit downloads, customer history, dashboard card filters, version preservation, multi-page navigation, tablet layout, and Admin conflict attribution.

[Verification record](docs/VERIFICATION.md) describes the completed checks and deployment limits.

## Project structure

```text
backend/app/        Config, models, validation, auth, calculations, quotation service, PDF and REST API
backend/data/       Original workbook, extracted real data and logo
backend/migrations/ Versioned Alembic schema migration
backend/tests/      Isolated workflow and permission tests
frontend/app/       Dashboard, login, editor, history, detail, master, conflicts, customers and settings
frontend/components/ Shared shell, editor, product picker and tables
frontend/lib/       Typed data contracts and API client
frontend/tests/     Browser workflow tests
scripts/           Local launcher, read-only workbook inspection and extraction
docs/              Source mapping, complete workbook audit and verification record
```

## Backup and troubleshooting

For SQLite, stop services and back up `backend/data/casamelia.db`, or use SQLite's online backup API as shown in the upgrade helper. For PostgreSQL, schedule `pg_dump` backups and test restoration. Documents are database BLOBs; preserve the full database and source assets. The local pre-upgrade backup is under `tmp/database-backups/` and is excluded from the distributable archive.

- Login fails: verify the backend is running and `API_URL` is correct. Seed passwords never reset an existing account; use Admin password reset.
- Price unavailable: check unresolved conflicts, inactive items, area assignment or an explicitly unpriced source product.
- Download blocked: use the saved PDF/Excel buttons in quotation details.
- HTTP 409 on editing: reload the latest quotation revision before saving.
- Import blocked: review duplicate combinations, stale price previews and unresolved conflicts. Generate a fresh preview after resolving them.
- Missing schema columns after an upgrade: back up, stop services and run `cli init` before starting the backend.
- Root `.env` not read in manual mode: export backend environment variables in your shell. Docker Compose reads `.env`.

## Version 2 workflow corrections

- Every dashboard summary card links to its management page. Draft/Generated cards apply URL status filters; the quotation list displays the filtered value summary.
- Customer names open customer details with contact information, projects and permitted quotation history. Document actions serve the saved version files without regeneration.
- Master Rate remains visible. Use **Change quotation rate** to edit the project rate. A numerically equal rate is not an override; resetting to Master Rate clears the reason and active attribution. A differing rate requires a reason and records user/time.
- Generate saves PDF and XLSX, then opens `/quotations/{id}/preview?revision={revision}`. The PDF.js viewer renders the actual saved PDF with page count/navigation, zoom, fit-to-width and full screen. Use the selectable PDF/print link for the native PDF viewer. No document downloads automatically.
- Quotation details and version history link to previews and downloads for each saved version, including generation attribution. Editing retains earlier PDFs/Excel files.
- Casamelia colors and existing business calculations remain unchanged. No database migration is needed for this UI/workflow update.


## Responsive phone, tablet and desktop workspace

One application uses the same server, accounts, database and document versions on all devices. Phone history/master/customer tables become labelled cards; phone and tablet navigation uses a drawer. Dashboard cards use one column on phones, two on tablets and four on desktops. Touch controls are at least 44px; measurement/rate inputs use decimal keyboards.

The phone editor supports searchable customers, full-screen product selection, two-column measurements, project rate overrides, collapsible area sections and a bottom Save/Generate bar. Generation still opens the actual A4 PDF; the phone viewer has zoom, pages, full screen and reachable PDF/Excel/Edit actions. It does not generate mobile-sized documents.

Customer lists are paginated; the editor searches customers on the server and fetches 30 matches. Master/product search and pagination remain server-side. Customer cards show permitted project/quotation counts and the latest saved quotation amount.

### Using a phone with the local server

`localhost` on a phone refers to the phone. To access this computer from a phone, connect both to the same network, use this computer's LAN address such as `http://192.168.1.20:3100`, and add that exact origin to `ALLOWED_ORIGINS` before launching the backend. Keep `API_URL` pointing at the backend on this computer. The frontend listens on all interfaces; configure the computer firewall to allow the chosen frontend port. For access from project sites, deploy the same app under HTTPS as described above.

### Installable web app

The app includes a standalone manifest, original Casamelia logo icons and a service worker. On supported Chromium browsers, **Install Casamelia app** appears in navigation when installation is offered. On iPhone/iPad Safari, use Share → Add to Home Screen. Installation requires HTTPS or localhost; ordinary HTTP LAN addresses are for browser use. Browser/OS installation prompts vary.

The app needs a connection for shared quotations. It does not cache authenticated APIs, quotation documents or customer data offline. The service worker provides a connection-required page when navigation cannot reach the server. PDF.js is prepared automatically during `npm ci`, including for fresh GitHub checkouts.

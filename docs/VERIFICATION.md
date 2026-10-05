# Verification — October workbook upgrade

Verified on Windows, 3 October 2026. The workbook supplies products, specifications, rates and area relationships. The sample PDF is a visual reference only; its quotation business data is not imported.

## Completed checks

- Extracted all 13 sheets, instructions, hidden Lists/MasterFlat, formulas/cached values and workbook XML covering formatting, validations, named ranges and layout.
- Import: 662 active selections, nine areas, 1,145 preserved price source records, 32 unresolved current conflicts. Earlier 238 catalogue records remain preserved.
- **17 backend tests passed**: authentication, ownership/roles, area filtering/assignments, validation, project overrides, custom/unpriced/hardware calculations, price conflicts, reviewed imports and changed-conflict rejection, PDF/Excel snapshots, historical downloads, formula injection protection and Admin finalization.
- Production frontend build and TypeScript checks passed.
- **Two Microsoft Edge browser tests passed**: Sales/customer/area/exact real product selection, project override, measurements, Other charges, draft save, both automatic downloads, history/tablet layout; Admin conflict resolution and attribution.
- Browser calculation: 22 sq ft × (₹1,850 project rate + ₹1,210 rate addition) + ₹4,000 one-time charge = ₹71,320; GST ₹12,837.60; total ₹84,157.60. Master Rate remained ₹1,990.
- Later master/company/terms changes left original PDF and XLSX bytes identical. Generating another revision retained earlier downloads.
- Independent Artifact Tool recalculation verified editable XLSX formulas: ₹40,700 subtotal, ₹7,326 GST, ₹48,026 total. Rendered workbook inspected: GST displays 18%, labels fit, real cells remain editable.
- Normal PDF and all three pages of a 36-item/nine-area stress PDF rendered and inspected. Repeated blue headers remain intact; sections, totals, terms and signatures align; output has selectable text on A4.
- 21st UI review: 21 files, zero errors, zero warnings, 64 informational color-token suggestions. Casamelia styling retained.
- Local database backed up before migration. All three existing PDF hashes preserved exactly. Actual database retains all 32 current conflicts unresolved; browser resolution tests used an isolated database.
- Final live browser smoke check passed Admin/Sales login and dashboard on port 3100. Admin sees 662 active catalogue entries; Sales sees 630 because 32 conflicts are blocked. The Admin finalization button passed a separate browser check against the isolated test database.

## Practical limits

- Docker/PostgreSQL are unavailable here. Live PostgreSQL migrations and container deployment require testing on the target server; local verification used SQLite.
- The reference PDF is US Letter, while output is A4. Pagination adapts to A4 and complete terms instead of copying clipped source text.
- Bank details remain blank until Admin enters approved business information, consistent with the PDF being visual-only.
- Future reviewed imports update Master List rows. Revised area-only specifications/relationships require Admin review through catalogue/Areas screens. Uploads and reports remain archived.
- Editable Excel prints on A4 landscape and recalculates formulas when opened. Amount in words records the saved total; external edits do not alter the application's saved quotation.
- Microsoft Excel was not opened. XLSX structure/formulas were checked with openpyxl and independently recalculated/rendered using Artifact Tool.
- A nonblocking Starlette/httpx deprecation warning remains in tests.

See README for repeatable checks. Browser tests resolve a conflict, so use a fresh test database.


## Version 2 acceptance checks — 3 October 2026

The current workflow supersedes automatic downloads described in the earlier checks above.

- **19 backend tests passed**, including Master Rate 100 / Quotation Rate 100 → no override and null reason; rate 90 → override/reason required; reset 100 → no override/null reason/cleared active attribution. Customer history, saved document access and customer ownership passed.
- **Four Edge browser tests passed**: complete editor/generate/preview/explicit-download flow; customer history; edit and generate a new version while old PDF stays byte-identical; all seven dashboard cards/routes/filters; Admin conflict resolution; saved multi-page PDF navigation without another generation request.
- Both editor and quotation-details generation paths opened actual PDF preview and produced zero download events. PDF/XLSX downloads occurred only after explicit clicks.
- Frontend production build/TypeScript passed. PDF.js worker is bundled with the application, with no external PDF service.
- UI review checked 25 files: zero errors, zero warnings, 68 informational color-token suggestions. Dashboard, editor, normal preview and page 2 preview screenshots were visually reviewed.
- The dashboard browser test initially navigated away before login completed; waiting for the authenticated dashboard fixed the test. Final test report has no failures.
- Existing business database and source prices were not altered by browser tests; all test quotations/conflict decisions used isolated databases.


## Responsive acceptance checks

Final combined browser suite: **14 passed** (including all nine viewport tests and cross-device creation/editing). Production build passed.

- Responsive management screens were tested at 320×568, 375×667, 390×844, 430×932, 768×1024, 820×1180, 1366×768, 1440×900 and 1920×1080. Dashboard, history, customers, Master List, conflicts, settings, areas, imports and editor had no page-level horizontal overflow.
- Phone/tablet drawer, one/two/four-column dashboards, semantic tables presented as phone cards, full-screen selection modals, decimal inputs, area collapse and sticky actions were checked.
- A touch-enabled 390px phone test created/saved/generated a real catalogue quotation, changed the project rate, previewed without automatic downloads and explicitly downloaded PDF/Excel. The same account reopened the quotation in a separate 1366px laptop context; a laptop quantity change then appeared back on the phone.
- All 19 backend tests passed after paginated customer search and role-scoped project/latest-quotation summaries were added.
- Manifest, icon availability and service-worker registration were checked at every test viewport. Native OS home-screen prompts were not manually exercised; browser installation support depends on HTTPS/localhost and the browser. No business data is cached offline.
- UI review: 30 files, zero errors, zero warnings, 72 informational token suggestions. Existing Casamelia branding and A4 generation are preserved.
- Two initial phone-test locator mistakes were corrected to match the existing accessible control names; the completed phone workflow passed.

## Vercel deployment preparation

- **29 backend tests passed**: the existing 19 tests plus managed PostgreSQL URL
  normalization, production configuration guards, prevention of preview database
  initialization, serialized cloud setup using a direct connection, lock release
  after setup failure and actual A4 PDF generation using only bundled fonts.
- Frontend production build and TypeScript passed after server-only API hosting
  configuration, proxy timeout and optional deployment-protection forwarding.
- Bundled DejaVu font archive was verified against the upstream SHA-256; original
  fonts and redistribution license are included. The rendered cloud-font PDF was
  visually checked; measurement label padding was adjusted to keep Length intact.
- Root FastAPI and frontend Next.js Vercel configuration, cloud database build
  initialization, environment examples and browser-based hosting instructions are
  included. Runtime dependencies omit development/testing PDF inspection tools.
- No hosted PostgreSQL or Vercel deployment has been exercised: hosting account
  access and database provisioning are still required. Mocked migration-lock tests
  verify orchestration, not a real PostgreSQL migration. Local business data was
  not modified or migrated to the cloud.

## Vercel import/startup investigation (5 October 2026)

- Root `app.py` exports `backend.app.main.app`, the existing FastAPI instance.
  Root `vercel.json` selects that file. Local import inspection found no missing
  runtime packages or broken backend relative imports with valid configuration.
- Reproduced explicit import-time RuntimeErrors when APP_ENV, DATABASE_URL or
  ALLOWED_ORIGINS is absent. The supplied online log excerpt does not contain
  its final exception, so the exact hosted failure is still unconfirmed.
- The build now checks the real root file even when database initialization is
  disabled. It loads by filename to avoid confusing it with backend/app.
- The existing app now serves service information at `/`; `/health` retains
  its database connectivity check. No replacement FastAPI app was created.
- **33 backend tests passed**, including the real entrypoint/lifespan under
  Vercel-like production variables and missing-variable build failures.
- Cloud build validation passed locally. A temporary Uvicorn `app:app` process
  returned HTTP 200 at `/` and HTTP 401 at `/auth/me`. This used a deliberately
  unreachable test database to verify startup/root do not require a connection;
  it does not validate hosted PostgreSQL connectivity or migrations.
- Live Vercel logs and the deployed URL are still required for hosted diagnosis
  and acceptance testing. No deployment secrets or sample database credentials
  were added to application configuration.

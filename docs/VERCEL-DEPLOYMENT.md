# Hosted Casamelia: website access for your team

Team members only need the website link, their username/password and an internet
connection. They do not install Python, Node, PostgreSQL or run commands. Phones,
tablets and computers all use the same application and database.

The following one-time steps are for the person managing hosting. They are all
performed in the Vercel website; the build server runs the setup automatically.

## Architecture

Import the same GitHub repository into **two Vercel projects**:

| Project | Root directory | Framework | Purpose |
| --- | --- | --- | --- |
| casamelia-api | repository root (`./`) | FastAPI | Authentication, calculations, documents, database access |
| casamelia-web | `frontend` | Next.js | Responsive website your team opens |

Connect a managed PostgreSQL database, such as Neon through Vercel Marketplace,
to the API project. Saved quotation versions, PDF bytes and Excel bytes are in
PostgreSQL. Vercel's temporary filesystem is not used for business storage.

GitHub repository:
https://github.com/varunsai45/CASAMELIA-QUOTATION-SOFTWARE

Vercel Hobby is for personal, non-commercial use. Use an eligible plan for the
company application. Review Vercel and database pricing before provisioning.

## 1. Create both project entries

1. Sign in at https://vercel.com/new and select the GitHub repository.
2. Create the API project with Root Directory `./` and Framework **FastAPI**.
3. Create the web project from the same repository, Root Directory `frontend`,
   Framework **Next.js**. Keep the default output directory. Do not select
   `backend` as the API root: migration files and its entrypoint are at repo root.
4. Note the stable production domain for each project. Examples throughout this
   guide are placeholders; replace them with the actual assigned domains.

An initial API deployment without environment variables will fail safely. Add
the settings below and redeploy it. An unconfigured web project can render the
login page but cannot authenticate until API_URL is set.

## 2. Connect PostgreSQL

In the API project's **Storage / Marketplace**, create or connect Neon PostgreSQL
(or another managed PostgreSQL service). Use its **pooled SSL connection string**
as `DATABASE_URL`. A supplied `postgresql://` or `postgres://` URL is normalized
to the installed psycopg driver automatically. Include `sslmode=require`.
Also copy the **direct/unpooled** SSL connection string for the same database
as `DIRECT_DATABASE_URL`. Migrations and import serialization use this direct
connection; web requests use the pooled connection.

Set credentials in Vercel's environment variable UI. Do not commit connection
strings or share them with staff. Enable provider backups suitable for the
business and keep the account under company ownership.

## 3. API project environment variables

Add these in **Settings → Environment Variables**, **Production scope only**:

| Variable | Value |
| --- | --- |
| APP_ENV | `production` |
| DATABASE_URL | Your managed PostgreSQL pooled SSL connection string |
| DIRECT_DATABASE_URL | Direct/unpooled SSL connection string for the same database |
| ALLOWED_ORIGINS | Exact HTTPS production website URL, e.g. `https://casamelia-web.vercel.app` |
| COOKIE_SECURE | `true` |
| SESSION_HOURS | `8` |
| CASA_INITIALIZE_DATABASE | `true` |
| ADMIN_PASSWORD | A unique admin password of at least 12 characters |
| SALES_PASSWORD | A different sales password of at least 12 characters |

Do not use `admin123` / `sales123` for hosting. These are rejected in production.
The initial usernames are `admin` and `sales`. Admin can create individual sales
accounts under **Settings → User access** after first login.

Redeploy the API. Its cloud build installs dependencies, takes a PostgreSQL
advisory lock, runs Alembic migrations, initializes hashed user credentials and
imports the preserved source catalogue. Repeated builds preserve existing users,
quotes, document versions and conflict resolutions. Conflicts remain unresolved
until Admin explicitly chooses an official price.

After initial setup, ADMIN_PASSWORD and SALES_PASSWORD can be removed from the
hosting environment. Existing users are not reset on later deployments. Leave
CASA_INITIALIZE_DATABASE enabled so schema migrations run on production builds.

**Existing local data:** a fresh cloud database imports source data, not your
local SQLite quotations, generated files or current admin conflict decisions.
If those records must move to hosting, arrange and verify a separate data
migration before inviting staff. The local database remains unchanged by setup.

## 4. Web project environment variables

In the web project's Production environment, set:

| Variable | Value |
| --- | --- |
| API_URL | Stable HTTPS production API domain, e.g. `https://casamelia-api.vercel.app` |

API_URL is a server-only value. Do not prefix it or database credentials with
NEXT_PUBLIC_. Redeploy the website after changing variables.

If the API project has Vercel Deployment Protection, an authorized project owner
can create its automation bypass secret and set that value as the website's
server-only `API_DEPLOYMENT_BYPASS_SECRET`. Application login, sessions and role
checks remain enforced. Do not expose the secret in links or client code.

Use stable production domains rather than a different deployment URL on each
push. If a custom website domain is added later, update ALLOWED_ORIGINS and
redeploy the API. Multiple permitted HTTPS origins are comma-separated.

## 5. Verify before sharing the website

1. Check that both production deployments show **Ready**. The API `/health`
   endpoint checks the service process; successful login confirms database access.
2. Log into the website as Admin and Sales using the hosting passwords.
3. Confirm actual catalogue data and unresolved conflicts are present.
4. Create a quotation, save a draft, reopen it and generate a version.
5. Confirm the actual PDF preview opens, with no automatic download.
6. Explicitly download PDF and editable Excel. Check their content and layout.
7. Edit and generate a second version; ensure the first files stay unchanged.
8. Open the same account on a phone and laptop; confirm shared records and role
   restrictions. Create separate accounts for each sales executive.
9. Check company/bank settings and terms before sending a real quotation.

Then share **only the web project URL** with staff. They never need the API,
database credentials, source files or hosting dashboard access.

## Preview deployments and limits

- Do not attach the production database to development or preview deployments.
  Production variables above are scoped only to Production. A preview API needs
  a separate database initialized by a deliberate administrative process.
  Cloud initialization explicitly refuses to run in a preview build.
- Both API and proxy allow up to 60 seconds for quotation requests. Very large
  quotations should be load-tested against the selected hosting plan.
- Vercel Functions have a 4.5 MB request/response payload limit. Ordinary saved
  quotation files are expected to fit, but large logos/imports/documents may
  exceed it. For larger documents, move document delivery to private object
  storage with authenticated short-lived URLs, or use the provided container
  deployment on a host supporting larger responses. Files must remain linked
  to their immutable quotation version.
- The PDF runtime includes licensed DejaVu fonts, so Linux hosting needs no
  manual font installation. Generated PDFs remain A4.
- There is no offline business-data cache. A connection is required to log in,
  save and generate. Home-screen installation requires HTTPS and browser support.

## Status of this preparation

Deployment configuration is in the repository. A live Vercel deployment,
managed PostgreSQL initialization and hosted end-to-end acceptance checks still
require access to the actual hosting account. Local tests are not a substitute
for those hosted checks.

## Official references

- FastAPI: https://vercel.com/docs/frameworks/backend/fastapi
- Python runtime: https://vercel.com/docs/functions/runtimes/python
- PostgreSQL integrations: https://vercel.com/docs/storage
- Function limits: https://vercel.com/docs/functions/limitations
- Hobby plan rules: https://vercel.com/docs/plans/hobby

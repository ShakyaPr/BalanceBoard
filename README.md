# Finance Dashboard

A React + Node dashboard for importing credit-card statement payloads, saving them into a relational database, and viewing all cards from one place.

## What this project includes

- `server/`: Express API with schema validation, Prisma data model, and dashboard aggregation.
- `client/`: React dashboard that reads the aggregated API and shows cross-card summaries.
- Existing Django starter files are left untouched, but they are not used by this implementation.

## Database shape

The backend stores the payload in a normalized structure:

- `CreditCard`
  - one row per card name
- `CardStatement`
  - one row per card and statement date
  - stores `totalPayable`, `amountDue`, statement date, and due date
- `CardTransaction`
  - child rows for each statement transaction
  - stores raw `MM/DD` label plus parsed month/day for sorting

The Prisma schema lives in [server/prisma/schema.prisma](/Users/shakya/Documents/personal-files/finance-mgt/finance-dashboard/server/prisma/schema.prisma).

## API endpoints

- `POST /api/statements`
  - validates and saves one statement payload
  - upserts the card by `name`
  - upserts the statement by `(card, statementDate)`
  - replaces transactions when the same statement is sent again
- `GET /api/dashboard`
  - returns the latest statement per card plus portfolio totals for the dashboard
- `GET /api/health`
  - simple health check

## Payload note

Your sample schema has a mismatch:

- property list uses `minimum_amount`
- required list uses `total_payable`

The backend accepts either `minimum_amount` or `total_payable` and normalizes both into the stored `totalPayable` field. It still requires `name`, `date`, `monthly_amount`, `due_date`, and `transactions`.

## Example payload

```json
{
  "name": "Visa Gold",
  "date": "04/01/26",
  "minimum_amount": 1250.45,
  "monthly_amount": 125.0,
  "due_date": "04/22/26",
  "transactions": [
    {
      "date": "03/28",
      "description": "Supermarket",
      "amount": 92.15,
      "type": "debit"
    },
    {
      "date": "03/30",
      "description": "Payment received",
      "amount": -200.0,
      "type": "credit"
    }
  ]
}
```

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL`.
4. Copy `client/.env.example` to `client/.env` if you want a custom API URL.
5. Run `npm run prisma:generate --workspace server`.
6. Run `npm run prisma:push --workspace server`.
7. Run `npm run dev`.

## Docker

The repo now includes:

- [docker-compose.yml](/Users/shakya/Documents/personal-files/finance-mgt/finance-dashboard/docker-compose.yml)
- [server/Dockerfile](/Users/shakya/Documents/personal-files/finance-mgt/finance-dashboard/server/Dockerfile)
- [client/Dockerfile](/Users/shakya/Documents/personal-files/finance-mgt/finance-dashboard/client/Dockerfile)
- [client/nginx.conf](/Users/shakya/Documents/personal-files/finance-mgt/finance-dashboard/client/nginx.conf)

### What gets containerized

- `db`: optional PostgreSQL 16 for local Docker-only use
- `server`: Node + Express + Prisma on port `4000`
- `client`: built React app served by Nginx on port `8080`

The frontend proxies `/api` requests to the backend through Nginx, so you only need to open one browser URL.

### Docker steps for an existing database

1. Copy [.env.docker.example](/Users/shakya/Documents/personal-files/finance-mgt/finance-dashboard/.env.docker.example) to `.env`:

```bash
cp .env.docker.example .env
```

2. Edit `DATABASE_URL` in `.env` so it points to your already-running PostgreSQL instance.

Example:

```env
DATABASE_URL=postgresql://finance_user:strong_password@10.0.0.15:5432/finance_dashboard?schema=public
```

3. Build and start the app containers:

```bash
docker compose up --build -d
```

4. Open the app:

```text
http://localhost:8080
```

5. Check the backend directly if needed:

```text
http://localhost:4000/api/health
```

### Docker steps with the bundled local database

If you want Docker to also run PostgreSQL locally, start the `local-db` profile:

```bash
DATABASE_URL=postgresql://finance_user:finance_password@db:5432/finance_dashboard?schema=public \
docker compose --profile local-db up --build -d
```

### Useful Docker commands

View logs:

```bash
docker compose logs -f
```

View only backend logs:

```bash
docker compose logs -f server
```

Rebuild after code changes:

```bash
docker compose up --build
```

### Notes

- The backend container runs `prisma db push` automatically on startup.
- `RUN npx prisma generate` in the backend image generates the Prisma client code from [server/prisma/schema.prisma](/Users/shakya/Documents/personal-files/finance-mgt/finance-dashboard/server/prisma/schema.prisma), so your app can call the database using typed Prisma APIs at runtime.
- `npx prisma generate` does not connect to the database or change tables. It only builds the client library.
- `npx prisma db push` is the command that actually syncs the schema to the target database.
- For VM deployment with an existing DB, the only required change is setting `DATABASE_URL` in `.env` to that database host.

## Dashboard behavior

The frontend shows:

- total cards tracked
- combined outstanding balance
- combined amount due
- next upcoming due date
- latest statement summary for each card
- recent transactions across the latest statements

## Save logic summary

When `POST /api/statements` receives a payload:

1. The payload is validated and normalized.
2. The card is upserted by `name`.
3. The statement is upserted by `card + statement date`.
4. Transactions for that statement are replaced with the incoming list.
5. The dashboard endpoint rolls up the latest statement for each card into a single summary response.

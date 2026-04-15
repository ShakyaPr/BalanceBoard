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

The Prisma schema lives in [server/prisma/schema.prisma](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/server/prisma/schema.prisma).

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

The backend accepts either `minimum_amount` or `total_payable` for the minimum due amount. It stores:

- `monthly_amount` as `totalPayable`
- `minimum_amount` or `total_payable` as `amountDue`

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
3. Copy [server/.env.example](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/server/.env.example) to `server/.env` and set either `DATABASE_URL` or the `DB_*` values.
4. Copy `client/.env.example` to `client/.env` if you want a custom API URL.
5. Run `npm run prisma:generate --workspace server`.
6. Run `npm run prisma:push --workspace server`.
7. Run `npm run dev`.

## Docker

The repo now includes:

- [docker-compose.yml](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/docker-compose.yml)
- [docker-compose.dokploy.yml](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/docker-compose.dokploy.yml)
- [server/Dockerfile](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/server/Dockerfile)
- [client/Dockerfile](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/client/Dockerfile)
- [client/nginx.conf](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/client/nginx.conf)

### What gets containerized

- `db`: optional PostgreSQL 16 for local Docker-only use
- `server`: Node + Express + Prisma on port `4000`
- `client`: built React app served by Nginx on port `8080`

The frontend proxies `/api` requests to the backend through Nginx, so you only need to open one browser URL.

### Docker steps for a separately started database container

1. Copy [.env.docker.example](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/.env.docker.example) to `.env`:

```bash
cp .env.docker.example .env
```

2. Edit `.env` so the `server` container can reach the database container you started manually.

Example:

```env
APP_NETWORK=balanceboard-net
DB_HOST=your-db-container
DB_PORT=5432
DB_NAME=finance_dashboard
DB_USER=finance_user
DB_PASSWORD=strong_password
DB_SCHEMA=public
```

3. Build and start the app services:

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

You can still use `DATABASE_URL` directly if you prefer. If the DB is running in another container, both containers must be on the same Docker network and `DB_HOST` must match that container name or alias.

For a manually started DB container, either:

1. Start it on the same Docker network as this app:

```bash
docker network create balanceboard-net
docker run -d --name apimdb --network balanceboard-net -p 5432:5432 \
  -e POSTGRES_DB=finance_dashboard \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=root \
  postgres:17
```

2. Or connect an already-running DB container to that network:

```bash
docker network connect balanceboard-net apimdb
```

If you prefer to reach the DB through the host-published port instead of Docker DNS, set `DB_HOST=host.docker.internal`. The compose file includes a host-gateway mapping for the server container.

### Docker steps with the bundled local database

If you want Docker to also run PostgreSQL locally, start the `local-db` profile:

```bash
DB_HOST=db docker compose --profile local-db up --build -d
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
- The backend accepts either a full `DATABASE_URL` or separate `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_SCHEMA` variables.
- `RUN npx prisma generate` in the backend image generates the Prisma client code from [server/prisma/schema.prisma](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/server/prisma/schema.prisma), so your app can call the database using typed Prisma APIs at runtime.
- `npx prisma generate` does not connect to the database or change tables. It only builds the client library.
- `npx prisma db push` is the command that actually syncs the schema to the target database.
- For service deployment with another DB container, the only required change is setting `DATABASE_URL` or the `DB_*` variables in `.env` to that container's reachable hostname on a shared Docker network.

## Dokploy

For Dokploy, use the Docker Compose service type and point it to [docker-compose.dokploy.yml](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/docker-compose.dokploy.yml). This file is intended for Git-based deployment and avoids fixed host port bindings, which is usually a better fit for Dokploy domains and shared hosts.

### Recommended Dokploy setup

1. Create a `Docker Compose` app in Dokploy.
2. Connect your Git repository and branch.
3. Set the compose path to `docker-compose.dokploy.yml`.
4. Add the variables from [.env.dokploy.example](/Users/shakya/Documents/personal-files/finance-mgt/BalanceBoard/.env.dokploy.example) in Dokploy's environment variables UI.
5. In Dokploy Domains, route your public domain to:
   `client` service on port `80`

### DB connectivity for Dokploy

If your PostgreSQL container is started separately, it must be reachable from the Dokploy-deployed services:

- Preferred: attach that DB container to the same Docker network named by `APP_NETWORK`
- Alternative: use `DB_HOST=host.docker.internal` if the DB is exposed on the host and reachable through the host gateway

If you use the Docker network approach, `DB_HOST` should be the DB container name or alias on that network.

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

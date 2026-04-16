# Internal Tool API

Scalable NestJS backend API for managing account-managed clients and their contact people.

## Stack

- NestJS
- PostgreSQL
- Prisma ORM
- JWT authentication
- Role-based authorization: `ADMIN`, `ACCOUNT_MANAGER`, `STAFF`
- Nodemailer
- node-cron

## Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma db seed
pnpm start:dev
```

The API runs under the `/api` prefix. Health check: `GET /api`.

## Main Endpoints

- `POST /api/auth/login`
- `POST /api/users` admin only
- `GET /api/users` admin/account manager
- `POST /api/clients` admin/account manager
- `GET /api/clients?page=1&limit=20&search=acme`
- `GET /api/clients/:id`
- `PATCH /api/clients/:id` admin/account manager
- `DELETE /api/clients/:id` admin/account manager, soft deletes client and contacts
- `POST /api/contacts`
- `GET /api/clients/:clientId/contacts`
- `GET /api/contacts/:id`
- `PATCH /api/contacts/:id`
- `DELETE /api/contacts/:id`
- `GET /api/activity-logs`

`STAFF` users can view clients and contacts only. `ACCOUNT_MANAGER` users can only access clients assigned to them. `ADMIN` users can access all records.

## Login And User Creation

There is no public self-register endpoint by design. Account managers and staff are authenticated only after a user record exists.

You can create login users in three ways:

- Seed the first admin with `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run `pnpm prisma db seed`.
- Use the admin-only `POST /api/users` endpoint to create account managers and staff.
- Import account managers and staff from CSV/XLSX with `pnpm import:data`.

Imported users can login with the password column from the spreadsheet. If a password column is not present, the importer uses `IMPORT_DEFAULT_PASSWORD`, which should be changed after first login in a real deployment.

## CSV/XLSX Import

The import command accepts either one workbook with sheets named `Users`, `Clients`, and `Contacts`, or separate CSV/XLSX files.

```bash
# One workbook with Users, Clients, Contacts sheets
pnpm import:data -- --file ./data/import.xlsx

# Separate files
pnpm import:data -- --users ./data/users.csv --clients ./data/clients.csv --contacts ./data/contacts.csv

# Import only one table from a single file
pnpm import:data -- --file ./data/users.csv --type users
pnpm import:data -- --file ./data/clients.csv --type clients
pnpm import:data -- --file ./data/contacts.csv --type contacts
```

Recommended `Users` columns:

```csv
name,email,role,password,isActive
Jane Manager,jane.manager@example.com,ACCOUNT_MANAGER,ChangeMe123!,true
Sam Staff,sam.staff@example.com,STAFF,ChangeMe123!,true
```

Recommended `Clients` columns:

```csv
clientName,accountManagerEmail
Acme Ltd,jane.manager@example.com
```

Recommended `Contacts` columns:

```csv
clientName,accountManagerEmail,name,title,email,phone,birthday
Acme Ltd,jane.manager@example.com,John Doe,CEO,john@acme.example,+2348012345678,1988-06-15
```

The importer is upsert-oriented:

- Users are matched by email.
- Clients are matched by `clientName + accountManager`.
- Contacts are matched by `client + email`.

Import users first, then clients, then contacts. The single-workbook mode already follows that order.

## Birthday Reminders

The scheduler runs daily by default using `BIRTHDAY_CRON_EXPRESSION`.

- 2 days before a contact birthday: sends an internal reminder.
- 1 day before: sends another internal reminder.
- On the birthday: sends a congratulatory email to the contact.

Set `BIRTHDAY_CRON_ENABLED=false` in environments where this process should not run scheduled jobs.

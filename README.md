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

## Birthday Reminders

The scheduler runs daily by default using `BIRTHDAY_CRON_EXPRESSION`.

- 2 days before a contact birthday: sends an internal reminder.
- 1 day before: sends another internal reminder.
- On the birthday: sends a congratulatory email to the contact.

Set `BIRTHDAY_CRON_ENABLED=false` in environments where this process should not run scheduled jobs.

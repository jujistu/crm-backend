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
- Swagger (`@nestjs/swagger`)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma db seed
pnpm start:dev
```

The API runs under the `/api` prefix.

## Swagger UI

Available at `/docs` in non-production environments.

Use `POST /api/auth/login` to get a JWT token, then click **Authorize** in the Swagger UI and paste the token to authenticate all requests.

## Health Endpoints

- `GET /api` — server health check
- `GET /api/health/db` — database connection status

**GET /api response:**

```json
{
  "name": "internal-tool-api",
  "status": "ok",
  "timestamp": "2025-01-15T08:00:00.000Z"
}
```

**GET /api/health/db response:**

```json
{ "status": "ok", "database": "connected" }
```

---

## Main Endpoints

### Auth

#### POST /api/auth/login

**Request body:**

```json
{
  "email": "jane.manager@edgenet.com",
  "password": "ChangeMe123!"
}
```

**Response:**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "Jane Manager",
    "email": "jane.manager@edgenet.com",
    "role": "ACCOUNT_MANAGER"
  }
}
```

---

### Users

All user endpoints require `Authorization: Bearer <token>`.

#### POST /api/users — admin only

**Request body:**

```json
{
  "name": "Jane Manager",
  "email": "jane.manager@edgenet.com",
  "password": "ChangeMe123!",
  "role": "ACCOUNT_MANAGER"
}
```

`role` is optional, defaults to `STAFF`. Accepted values: `ADMIN`, `ACCOUNT_MANAGER`, `STAFF`.

**Response:** User object (see below)

#### GET /api/users — admin/account manager

**Query params:** `page`, `limit`, `search`

**Response:**

```json
{
  "items": ["<user object>"],
  "meta": {
    "total": 10,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

#### GET /api/users/:id — admin/account manager

**Response — User object:**

```json
{
  "id": "uuid",
  "name": "Jane Manager",
  "email": "jane.manager@edgenet.com",
  "role": "ACCOUNT_MANAGER",
  "isActive": true,
  "createdAt": "2025-01-15T08:00:00.000Z",
  "updatedAt": "2025-01-15T08:00:00.000Z"
}
```

#### PATCH /api/users/:id — admin only

**Request body** (all fields optional):

```json
{
  "name": "Jane Manager",
  "email": "jane.manager@edgenet.com",
  "password": "NewPassword123!",
  "role": "ACCOUNT_MANAGER",
  "isActive": true
}
```

**Response:** Updated user object

#### DELETE /api/users/:id — admin only

**Response:** Soft-deleted user object (`isActive: false`, `deletedAt` set)

---

### Clients

All client endpoints require `Authorization: Bearer <token>`.

#### POST /api/clients — admin/account manager

**Request body:**

```json
{
  "name": "Acme Ltd",
  "accountManagerId": "uuid",
  "contacts": [
    {
      "name": "John Doe",
      "email": "john.doe@acme.com",
      "title": "CEO",
      "phone": "+2348012345678",
      "birthday": "1985-06-15"
    }
  ]
}
```

`contacts` is optional (max 50). `birthday` must be `YYYY-MM-DD`.

**Response:** Client object (see below)

#### GET /api/clients — all roles

**Query params:** `page`, `limit`, `search`, `accountManagerId`, `accountManagerRole`

Account managers only see their own clients.

**Response:**

```json
{
  "items": ["<client object>"],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

#### GET /api/clients/:id — all roles

**Response — Client object:**

```json
{
  "id": "uuid",
  "name": "Acme Ltd",
  "accountManagerId": "uuid",
  "createdById": "uuid",
  "updatedById": "uuid",
  "deletedAt": null,
  "createdAt": "2025-01-15T08:00:00.000Z",
  "updatedAt": "2025-01-15T08:00:00.000Z",
  "accountManager": {
    "id": "uuid",
    "name": "Jane Manager",
    "email": "jane.manager@edgenet.com",
    "role": "ACCOUNT_MANAGER"
  },
  "contacts": ["<contact object>"],
  "createdBy": {
    "id": "uuid",
    "name": "Jane Manager",
    "email": "jane.manager@edgenet.com"
  },
  "updatedBy": {
    "id": "uuid",
    "name": "Jane Manager",
    "email": "jane.manager@edgenet.com"
  }
}
```

#### PATCH /api/clients/:id — admin/account manager

**Request body** (all fields optional):

```json
{
  "name": "Acme Ltd Updated",
  "accountManagerId": "uuid"
}
```

**Response:** Updated client object

#### DELETE /api/clients/:id — admin/account manager

Soft deletes the client and all its contacts.

**Response:** Soft-deleted client object (`deletedAt` set)

---

### Contacts

All contact endpoints require `Authorization: Bearer <token>`.

#### POST /api/contacts — admin/account manager

**Request body:**

```json
{
  "name": "John Doe",
  "email": "john.doe@acme.com",
  "title": "CEO",
  "phone": "+2348012345678",
  "birthday": "1985-06-15",
  "clientId": "uuid"
}
```

`title`, `phone`, `birthday` are optional. `birthday` must be `YYYY-MM-DD`.

**Response:** Contact object (see below)

#### GET /api/clients/:clientId/contacts — all roles

**Response:** Array of contact objects

#### GET /api/contacts/:id — all roles

**Response — Contact object:**

```json
{
  "id": "uuid",
  "name": "John Doe",
  "title": "CEO",
  "email": "john.doe@acme.com",
  "phone": "+2348012345678",
  "birthday": "1985-06-15T00:00:00.000Z",
  "clientId": "uuid",
  "createdById": "uuid",
  "updatedById": "uuid",
  "deletedAt": null,
  "createdAt": "2025-01-15T08:00:00.000Z",
  "updatedAt": "2025-01-15T08:00:00.000Z",
  "client": {
    "id": "uuid",
    "name": "Acme Ltd",
    "accountManagerId": "uuid"
  },
  "createdBy": {
    "id": "uuid",
    "name": "Jane Manager",
    "email": "jane.manager@edgenet.com"
  },
  "updatedBy": {
    "id": "uuid",
    "name": "Jane Manager",
    "email": "jane.manager@edgenet.com"
  }
}
```

#### PATCH /api/contacts/:id — admin/account manager

**Request body** (all fields optional):

```json
{
  "name": "John Doe",
  "title": "MD",
  "email": "john.doe@acme.com",
  "phone": "+2348012345678",
  "birthday": "1985-06-15",
  "clientId": "uuid"
}
```

**Response:** Updated contact object

#### DELETE /api/contacts/:id — admin/account manager

**Response:** Soft-deleted contact object (`deletedAt` set)

---

### Activity Logs

Requires `Authorization: Bearer <token>`. Admin and account managers only.

#### GET /api/activity-logs

Account managers only see logs for their own clients.

**Query params:** `page`, `limit`, `search`

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "action": "CREATE",
      "entity": "Client",
      "entityId": "uuid",
      "actorId": "uuid",
      "clientId": "uuid",
      "metadata": null,
      "createdAt": "2025-01-15T08:00:00.000Z",
      "actor": {
        "id": "uuid",
        "name": "Jane Manager",
        "email": "jane.manager@edgenet.com",
        "role": "ACCOUNT_MANAGER"
      },
      "client": {
        "id": "uuid",
        "name": "Acme Ltd"
      }
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

**`action` values:** `CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `BIRTHDAY_REMINDER`

---

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

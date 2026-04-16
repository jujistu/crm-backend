import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';

type Row = Record<string, unknown>;
type ImportArgs = {
  file?: string;
  users?: string;
  clients?: string;
  contacts?: string;
  type?: 'users' | 'clients' | 'contacts';
};

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = process.env.IMPORT_DEFAULT_PASSWORD ?? 'ChangeMe123!';

function parseArgs(): ImportArgs {
  const args = process.argv.slice(2);
  const parsed: ImportArgs = {};

  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];

    if (!key?.startsWith('--') || !value) {
      continue;
    }

    const normalizedKey = key.slice(2) as keyof ImportArgs;
    if (
      ['file', 'users', 'clients', 'contacts', 'type'].includes(normalizedKey)
    ) {
      parsed[normalizedKey] = value as never;
      index += 1;
    }
  }

  return parsed;
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

// function normalizeRow(row: Row): Row {
//   return Object.entries(row).reduce<Row>((accumulator, [key, value]) => {
//     accumulator[normalizeKey(key)] = value;
//     return accumulator;
//   }, {});
// }

function getString(row: Row, keys: string[]) {
  for (const key of keys.map(normalizeKey)) {
    const value = row[key];
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      if (trimmedValue !== '') {
        return trimmedValue;
      }
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      const normalizedValue = `${value}`.trim();
      if (normalizedValue !== '') {
        return normalizedValue;
      }
    }
  }

  return undefined;
}

function parseBoolean(value?: string) {
  if (!value) {
    return true;
  }

  return ['true', '1', 'yes', 'active'].includes(value.toLowerCase());
}

function parseRole(value?: string) {
  if (!value) {
    return Role.STAFF;
  }

  const normalized = value.toUpperCase().replace(/[\s-]/g, '_');
  if (!Object.values(Role).includes(normalized as Role)) {
    throw new Error(
      `Invalid role "${value}". Use ADMIN, ACCOUNT_MANAGER, or STAFF.`,
    );
  }

  return normalized as Role;
}

function parseDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date "${value}". Use YYYY-MM-DD where possible.`);
  }

  return date;
}

async function readRows(filePath: string, sheetName?: string): Promise<Row[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = sheetName
    ? (workbook.getWorksheet(sheetName) ?? workbook.worksheets[0])
    : workbook.worksheets[0];

  if (!sheet) {
    return [];
  }

  const headers: string[] = [];
  const rows: Row[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        const raw = cell.value;
        headers[colNumber] = normalizeKey(
          typeof raw === 'string' ||
            typeof raw === 'number' ||
            typeof raw === 'boolean'
            ? String(raw)
            : '',
        );
      });
      return;
    }

    const record: Row = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] =
          cell.type === ExcelJS.ValueType.Date
            ? (cell.value as Date).toISOString().slice(0, 10)
            : (cell.value ?? '');
      }
    });
    rows.push(record);
  });

  return rows;
}

async function ensureActor() {
  const email =
    process.env.IMPORT_ACTOR_EMAIL ??
    process.env.ADMIN_EMAIL ??
    'importer@example.com';

  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const actor = await prisma.user.create({
    data: {
      name: process.env.IMPORT_ACTOR_NAME ?? 'Data Importer',
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(
        process.env.IMPORT_ACTOR_PASSWORD ?? DEFAULT_PASSWORD,
        12,
      ),
      role: Role.ADMIN,
    },
    select: { id: true },
  });

  return actor.id;
}

async function importUsers(rows: Row[]) {
  let count = 0;

  for (const row of rows) {
    const email = getString(row, ['email', 'user email']);
    const name = getString(row, ['name', 'full name', 'account manager']);

    if (!email || !name) {
      continue;
    }

    await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        name,
        role: parseRole(getString(row, ['role'])),
        isActive: parseBoolean(
          getString(row, ['is active', 'active', 'status']),
        ),
        deletedAt: null,
      },
      create: {
        name,
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(
          getString(row, ['password']) ?? DEFAULT_PASSWORD,
          12,
        ),
        role: parseRole(getString(row, ['role'])),
        isActive: parseBoolean(
          getString(row, ['is active', 'active', 'status']),
        ),
      },
    });

    count += 1;
  }

  console.log(`Imported users: ${count}`);
}

async function resolveAccountManager(row: Row) {
  const accountManagerId = getString(row, [
    'account manager id',
    'accountManagerId',
  ]);
  const accountManagerEmail = getString(row, [
    'account manager email',
    'accountManagerEmail',
    'manager email',
  ]);
  const accountManagerName = getString(row, [
    'account manager',
    'account manager name',
    'manager',
  ]);

  const accountManager = await prisma.user.findFirst({
    where: {
      role: Role.ACCOUNT_MANAGER,
      deletedAt: null,
      isActive: true,
      OR: [
        ...(accountManagerId ? [{ id: accountManagerId }] : []),
        ...(accountManagerEmail
          ? [{ email: accountManagerEmail.toLowerCase() }]
          : []),
        ...(accountManagerName ? [{ name: accountManagerName }] : []),
      ],
    },
    select: { id: true },
  });

  if (!accountManager) {
    throw new Error(
      `Could not find account manager for client "${getString(row, ['client name', 'name']) ?? 'unknown'}". Import users first.`,
    );
  }

  return accountManager.id;
}

async function importClients(rows: Row[], actorId: string) {
  let count = 0;

  for (const row of rows) {
    const name = getString(row, ['client name', 'name', 'company']);
    if (!name) {
      continue;
    }

    const accountManagerId = await resolveAccountManager(row);
    const existing = await prisma.client.findFirst({
      where: {
        name,
        accountManagerId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.client.update({
        where: { id: existing.id },
        data: {
          name,
          accountManagerId,
          updatedById: actorId,
        },
      });
    } else {
      await prisma.client.create({
        data: {
          name,
          accountManagerId,
          createdById: actorId,
          updatedById: actorId,
        },
      });
    }

    count += 1;
  }

  console.log(`Imported clients: ${count}`);
}

async function resolveClient(row: Row) {
  const clientId = getString(row, ['client id', 'clientId']);
  const clientName = getString(row, ['client name', 'client', 'company']);
  const accountManagerId = getString(row, [
    'account manager id',
    'accountManagerId',
  ]);
  const accountManagerEmail = getString(row, [
    'account manager email',
    'accountManagerEmail',
    'manager email',
  ]);

  const client = await prisma.client.findFirst({
    where: {
      deletedAt: null,
      ...(clientId ? { id: clientId } : {}),
      ...(clientName ? { name: clientName } : {}),
      ...(accountManagerId ? { accountManagerId } : {}),
      ...(accountManagerEmail
        ? { accountManager: { email: accountManagerEmail.toLowerCase() } }
        : {}),
    },
    select: { id: true },
  });

  if (!client) {
    throw new Error(
      `Could not find client for contact "${getString(row, ['name', 'contact name']) ?? 'unknown'}". Import clients first.`,
    );
  }

  return client.id;
}

async function importContacts(rows: Row[], actorId: string) {
  let count = 0;

  for (const row of rows) {
    const name = getString(row, ['contact name', 'name']);
    const email = getString(row, ['email', 'contact email']);

    if (!name || !email) {
      continue;
    }

    const clientId = await resolveClient(row);
    await prisma.contactPerson.upsert({
      where: {
        clientId_email: {
          clientId,
          email: email.toLowerCase(),
        },
      },
      update: {
        name,
        title: getString(row, ['title', 'job title']),
        phone: getString(row, ['phone', 'telephone', 'mobile']),
        birthday: parseDate(getString(row, ['birthday', 'birth date', 'dob'])),
        updatedById: actorId,
        deletedAt: null,
      },
      create: {
        name,
        title: getString(row, ['title', 'job title']),
        email: email.toLowerCase(),
        phone: getString(row, ['phone', 'telephone', 'mobile']),
        birthday: parseDate(getString(row, ['birthday', 'birth date', 'dob'])),
        clientId,
        createdById: actorId,
        updatedById: actorId,
      },
    });

    count += 1;
  }

  console.log(`Imported contacts: ${count}`);
}

async function main() {
  const args = parseArgs();
  const actorId = await ensureActor();

  if (args.file && args.type) {
    const rows = await readRows(args.file);
    if (args.type === 'users') {
      await importUsers(rows);
    } else if (args.type === 'clients') {
      await importClients(rows, actorId);
    } else {
      await importContacts(rows, actorId);
    }
    return;
  }

  if (args.file) {
    await importUsers(await readRows(args.file, 'Users'));
    await importClients(await readRows(args.file, 'Clients'), actorId);
    await importContacts(await readRows(args.file, 'Contacts'), actorId);
    return;
  }

  if (args.users) {
    await importUsers(await readRows(args.users));
  }
  if (args.clients) {
    await importClients(await readRows(args.clients), actorId);
  }
  if (args.contacts) {
    await importContacts(await readRows(args.contacts), actorId);
  }

  if (!args.users && !args.clients && !args.contacts) {
    throw new Error(
      'Provide --file workbook.xlsx, or --users users.csv --clients clients.csv --contacts contacts.csv',
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, Role } from '../node_modules/.prisma/client/index.js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log('Skipping seed: ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    return;
  }

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      name: process.env.ADMIN_NAME ?? 'System Admin',
      role: Role.ADMIN,
      isActive: true,
      deletedAt: null,
    },
    create: {
      name: process.env.ADMIN_NAME ?? 'System Admin',
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: Role.ADMIN,
    },
  });

  console.log(`Admin user ready: ${email.toLowerCase()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

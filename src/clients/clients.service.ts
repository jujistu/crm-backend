import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Prisma, Role } from '@prisma/client';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ClientQueryDto } from './dto/client-query.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const clientInclude = {
  accountManager: {
    select: { id: true, name: true, email: true, role: true },
  },
  contacts: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  updatedBy: {
    select: { id: true, name: true, email: true },
  },
} satisfies Prisma.ClientInclude;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto, actor: RequestUser) {
    await this.ensureAccountManager(dto.accountManagerId);

    const client = await this.prisma.client.create({
      data: {
        name: dto.name,
        accountManagerId: dto.accountManagerId,
        createdById: actor.id,
        updatedById: actor.id,
        contacts: dto.contacts?.length
          ? {
              create: dto.contacts.map((contact) => ({
                name: contact.name,
                title: contact.title,
                email: contact.email.toLowerCase(),
                phone: contact.phone,
                birthday: contact.birthday
                  ? new Date(contact.birthday)
                  : undefined,
                createdById: actor.id,
                updatedById: actor.id,
              })),
            }
          : undefined,
      },
      include: clientInclude,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.CREATE,
        entity: 'Client',
        entityId: client.id,
        actorId: actor.id,
        clientId: client.id,
      },
    });

    return client;
  }

  async findAll(query: ClientQueryDto, actor: RequestUser) {
    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(actor.role === Role.ACCOUNT_MANAGER
        ? { accountManagerId: actor.id }
        : {}),
      ...(query.accountManagerId
        ? { accountManagerId: query.accountManagerId }
        : {}),
      ...(query.accountManagerRole
        ? { accountManager: { role: query.accountManagerRole } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              {
                contacts: {
                  some: {
                    deletedAt: null,
                    OR: [
                      { name: { contains: query.search, mode: 'insensitive' } },
                      {
                        email: { contains: query.search, mode: 'insensitive' },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: clientInclude,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(id: string, actor: RequestUser) {
    const client = await this.prisma.client.findFirst({
      where: this.clientAccessWhere(id, actor),
      include: clientInclude,
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(id: string, dto: UpdateClientDto, actor: RequestUser) {
    await this.findOne(id, actor);

    if (dto.accountManagerId) {
      await this.ensureAccountManager(dto.accountManagerId);
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        name: dto.name,
        accountManagerId: dto.accountManagerId,
        updatedById: actor.id,
      },
      include: clientInclude,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.UPDATE,
        entity: 'Client',
        entityId: client.id,
        actorId: actor.id,
        clientId: client.id,
      },
    });

    return client;
  }

  async remove(id: string, actor: RequestUser) {
    await this.findOne(id, actor);

    const now = new Date();
    const client = await this.prisma.$transaction(async (tx) => {
      await tx.contactPerson.updateMany({
        where: { clientId: id, deletedAt: null },
        data: { deletedAt: now, updatedById: actor.id },
      });

      const deletedClient = await tx.client.update({
        where: { id },
        data: {
          deletedAt: now,
          updatedById: actor.id,
        },
        include: clientInclude,
      });

      await tx.activityLog.create({
        data: {
          action: ActivityAction.DELETE,
          entity: 'Client',
          entityId: id,
          actorId: actor.id,
          clientId: id,
        },
      });

      return deletedClient;
    });

    return client;
  }

  private async ensureAccountManager(accountManagerId: string) {
    const accountManager = await this.prisma.user.findFirst({
      where: {
        id: accountManagerId,
        role: Role.ACCOUNT_MANAGER,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });

    if (!accountManager) {
      throw new BadRequestException(
        'accountManagerId must belong to an active account manager',
      );
    }
  }

  private clientAccessWhere(
    id: string,
    actor: RequestUser,
  ): Prisma.ClientWhereInput {
    return {
      id,
      deletedAt: null,
      ...(actor.role === Role.ACCOUNT_MANAGER
        ? { accountManagerId: actor.id }
        : {}),
    };
  }
}

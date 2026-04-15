import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Prisma, Role } from '@prisma/client';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactPersonDto } from './dto/create-contact-person.dto';
import { UpdateContactPersonDto } from './dto/update-contact-person.dto';

const contactInclude = {
  client: {
    select: {
      id: true,
      name: true,
      accountManagerId: true,
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  updatedBy: {
    select: { id: true, name: true, email: true },
  },
} satisfies Prisma.ContactPersonInclude;

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactPersonDto, actor: RequestUser) {
    await this.ensureClientAccess(dto.clientId, actor);
    await this.ensureUniqueEmail(dto.clientId, dto.email);

    const contact = await this.prisma.contactPerson.create({
      data: {
        name: dto.name,
        title: dto.title,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        clientId: dto.clientId,
        createdById: actor.id,
        updatedById: actor.id,
      },
      include: contactInclude,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.CREATE,
        entity: 'ContactPerson',
        entityId: contact.id,
        actorId: actor.id,
        clientId: contact.clientId,
      },
    });

    return contact;
  }

  async findAll(clientId: string, actor: RequestUser) {
    await this.ensureClientAccess(clientId, actor, true);

    return this.prisma.contactPerson.findMany({
      where: {
        clientId,
        deletedAt: null,
      },
      include: contactInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actor: RequestUser) {
    const contact = await this.prisma.contactPerson.findFirst({
      where: this.contactAccessWhere(id, actor),
      include: contactInclude,
    });

    if (!contact) {
      throw new NotFoundException('Contact person not found');
    }

    return contact;
  }

  async update(id: string, dto: UpdateContactPersonDto, actor: RequestUser) {
    const existing = await this.findOne(id, actor);
    const clientId = dto.clientId ?? existing.clientId;

    await this.ensureClientAccess(clientId, actor);

    if (dto.email && dto.email.toLowerCase() !== existing.email) {
      await this.ensureUniqueEmail(clientId, dto.email, id);
    }

    const contact = await this.prisma.contactPerson.update({
      where: { id },
      data: {
        name: dto.name,
        title: dto.title,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        birthday: dto.birthday ? new Date(dto.birthday) : undefined,
        clientId: dto.clientId,
        updatedById: actor.id,
      },
      include: contactInclude,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.UPDATE,
        entity: 'ContactPerson',
        entityId: contact.id,
        actorId: actor.id,
        clientId: contact.clientId,
      },
    });

    return contact;
  }

  async remove(id: string, actor: RequestUser) {
    const existing = await this.findOne(id, actor);

    const contact = await this.prisma.contactPerson.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: actor.id,
      },
      include: contactInclude,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.DELETE,
        entity: 'ContactPerson',
        entityId: contact.id,
        actorId: actor.id,
        clientId: existing.clientId,
      },
    });

    return contact;
  }

  private async ensureClientAccess(
    clientId: string,
    actor: RequestUser,
    allowStaff = false,
  ) {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        deletedAt: null,
        ...(actor.role === Role.ACCOUNT_MANAGER
          ? { accountManagerId: actor.id }
          : {}),
      },
      select: { id: true },
    });

    if (!client || (actor.role === Role.STAFF && !allowStaff)) {
      throw new NotFoundException('Client not found');
    }
  }

  private async ensureUniqueEmail(
    clientId: string,
    email: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.contactPerson.findFirst({
      where: {
        clientId,
        email: email.toLowerCase(),
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'This client already has a contact with this email',
      );
    }
  }

  private contactAccessWhere(
    id: string,
    actor: RequestUser,
  ): Prisma.ContactPersonWhereInput {
    return {
      id,
      deletedAt: null,
      client: {
        deletedAt: null,
        ...(actor.role === Role.ACCOUNT_MANAGER
          ? { accountManagerId: actor.id }
          : {}),
      },
    };
  }
}

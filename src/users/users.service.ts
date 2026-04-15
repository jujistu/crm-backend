import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityAction, Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto, actor: RequestUser) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash: await bcrypt.hash(dto.password, 12),
        role: dto.role ?? Role.STAFF,
      },
      select: userSelect,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.CREATE,
        entity: 'User',
        entityId: user.id,
        actorId: actor.id,
      },
    });

    return user;
  }

  async findAll(query: PaginationQueryDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
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

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: userSelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: RequestUser) {
    await this.findOne(id);

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          email: dto.email.toLowerCase(),
          id: { not: id },
        },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException('A user with this email already exists');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email?.toLowerCase(),
        role: dto.role,
        isActive: dto.isActive,
        ...(dto.password
          ? { passwordHash: await bcrypt.hash(dto.password, 12) }
          : {}),
      },
      select: userSelect,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.UPDATE,
        entity: 'User',
        entityId: user.id,
        actorId: actor.id,
      },
    });

    return user;
  }

  async remove(id: string, actor: RequestUser) {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
      select: userSelect,
    });

    await this.prisma.activityLog.create({
      data: {
        action: ActivityAction.DELETE,
        entity: 'User',
        entityId: user.id,
        actorId: actor.id,
      },
    });

    return user;
  }
}

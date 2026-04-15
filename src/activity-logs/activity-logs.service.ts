import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequestUser } from '../common/types/request-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto, actor: RequestUser) {
    const where: Prisma.ActivityLogWhereInput = {
      ...(query.search
        ? {
            OR: [
              { entity: { contains: query.search, mode: 'insensitive' } },
              { entityId: { equals: query.search } },
            ],
          }
        : {}),
      ...(actor.role === Role.ACCOUNT_MANAGER
        ? { client: { accountManagerId: actor.id } }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
          client: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.activityLog.count({ where }),
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
}
